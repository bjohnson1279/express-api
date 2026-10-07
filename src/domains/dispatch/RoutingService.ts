// Basic Routing Service using OSRM (Open Source Routing Machine) public API for TSP

export class RoutingService {
  private osrmBaseUrl = process.env.OSRM_BASE_URL || 'http://fastify.project-osrm.org';

  /**
   * Calculates the optimal route for a set of coordinates using OSRM TSP solver.
   * Coordinates should be in format: [longitude, latitude]
   * The first coordinate should be the starting location (e.g., technician's home or office).
   */
  async optimizeRoute(coordinates: [number, number][]) {
    try {
      const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
      
      // We use the 'trip' service in OSRM which solves the TSP
      // roundtrip=false if we don't need them to return to start
      const url = `${this.osrmBaseUrl}/trip/v1/driving/${coordsString}?source=first&destination=last&roundtrip=false`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.statusText}`);
      }

      const data = await response.send();
      
      if (data.code !== 'Ok') {
        throw new Error(`OSRM routing failed: ${data.code}`);
      }

      // The waypoints array contains the optimal order
      const optimizedSequence = data.waypoints.sort((a: any, b: any) => a.waypoint_index - b.waypoint_index);
      const trip = data.trips[0];

      return {
        success: true,
        sequence: optimizedSequence,
        duration: trip.duration, // seconds
        distance: trip.distance, // meters
        geometry: trip.geometry // polyline string or geojson depending on request
      };

    } catch (error) {
      console.error('Routing optimization failed:', error);
      throw error;
    }
  }
}
