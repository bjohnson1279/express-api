import { Request, Response } from 'express';
import { PrismaClient, TechStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Haversine distance formula approximation in miles
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

// Dummy geocoder for MVP
function geocodeProperty(property: any) {
  // Mock lat/lng based on string length to give pseudo-random deterministic locations
  const len = property?.address?.length || 10;
  return {
    lat: 34.0522 + (len * 0.01),
    lng: -118.2437 - (len * 0.01)
  };
}

export const optimizeRoute = async (req: Request, res: Response) => {
  try {
    const { jobIds, startLat, startLng } = req.body;
    
    const jobs = await prisma.job.findMany({
      where: { id: { in: jobIds } },
      include: { property: true }
    });

    if (!startLat || !startLng) {
      return res.json(jobs);
    }

    let currentLocation = { lat: startLat, lng: startLng };
    let unvisited = [...jobs];
    let route = [];

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const propCoords = geocodeProperty(unvisited[i].property);
        const dist = getDistance(currentLocation.lat, currentLocation.lng, propCoords.lat, propCoords.lng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextJob = unvisited[nearestIdx];
      route.push(nextJob);
      
      const nextCoords = geocodeProperty(nextJob.property);
      currentLocation = { lat: nextCoords.lat, lng: nextCoords.lng };
      
      unvisited.splice(nearestIdx, 1);
    }

    res.json(route);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const emergencyDispatch = async (req: Request, res: Response) => {
  try {
    const { propertyId, jobId } = req.body;
    
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return res.status(400).json({ error: 'Property not found' });
    }

    const propCoords = geocodeProperty(property);

    const technicians = await prisma.technician.findMany({
      where: { status: TechStatus.available },
      include: { user: true }
    });

    let nearestTech: any = null;
    let minDistance = Infinity;

    for (const tech of technicians) {
      if (tech.currentLocationLat && tech.currentLocationLng) {
        const dist = getDistance(propCoords.lat, propCoords.lng, tech.currentLocationLat.toNumber(), tech.currentLocationLng.toNumber());
        if (dist < minDistance) {
          minDistance = dist;
          nearestTech = tech;
        }
      }
    }

    if (!nearestTech) {
      return res.status(404).json({ error: 'No available technicians found nearby' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        technicianId: nearestTech.id,
        status: 'scheduled'
      }
    });

    res.json({
      message: `Emergency dispatch assigned to ${nearestTech.user.firstName} ${nearestTech.user.lastName}`,
      technician: nearestTech,
      job: updatedJob,
      distance: minDistance
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
