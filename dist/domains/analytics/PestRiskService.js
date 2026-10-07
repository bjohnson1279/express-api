"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PestRiskService = void 0;
const client_1 = require("@prisma/client");
const ClimateService_1 = require("./ClimateService");
const prisma = new client_1.PrismaClient();
class PestRiskService {
    /**
     * Determine seasonal vector based on current month
     */
    static getSeasonalVector(month) {
        if (month >= 2 && month <= 4) {
            return { vector: 'SPRING_EMERGENCE', factor: 1.25 };
        }
        else if (month >= 5 && month <= 7) {
            return { vector: 'SUMMER_PEAK', factor: 1.35 };
        }
        else if (month >= 8 && month <= 10) {
            return { vector: 'FALL_NESTING', factor: 1.10 };
        }
        else {
            return { vector: 'WINTER_DORMANCY', factor: 0.75 };
        }
    }
    /**
     * Calculate or update AI pest risk score for a property
     */
    static async calculatePropertyRisk(propertyId, tenantId) {
        const property = await prisma.property.findFirst({
            where: { id: propertyId },
            include: {
                customer: true,
                photos: true,
                jobs: {
                    include: {
                        chemicalLogs: {
                            orderBy: { appliedAt: 'desc' }
                        }
                    },
                    orderBy: { scheduledStart: 'desc' }
                }
            }
        });
        if (!property) {
            throw new Error(`Property ${propertyId} not found`);
        }
        // 1. Gather all chemical logs for this property
        const allChemicalLogs = property.jobs.flatMap(j => j.chemicalLogs).sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
        const latestLog = allChemicalLogs[0] || null;
        const now = new Date();
        let daysSinceLastTreatment = 90; // default if no prior application
        if (latestLog) {
            const diffTime = Math.abs(now.getTime() - new Date(latestLog.appliedAt).getTime());
            daysSinceLastTreatment = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        }
        // 2. Chemical degradation factor based on half-life (effective residual ~60 days)
        let chemicalDecayFactor = 1.0;
        if (daysSinceLastTreatment <= 25) {
            chemicalDecayFactor = 0.35; // high active barrier
        }
        else if (daysSinceLastTreatment <= 50) {
            chemicalDecayFactor = 0.70; // moderate protection
        }
        else if (daysSinceLastTreatment <= 75) {
            chemicalDecayFactor = 1.20; // depleted barrier
        }
        else {
            chemicalDecayFactor = 1.55; // complete residual breakdown
        }
        const lat = property.lat ? Number(property.lat) : 39.7817;
        const lng = property.lng ? Number(property.lng) : -89.6501;
        // 3. Live Climate API integration & Seasonal vector
        const currentMonth = now.getMonth();
        const { vector: seasonalVector, factor: seasonalFactor } = this.getSeasonalVector(currentMonth);
        const climate = await ClimateService_1.ClimateService.getClimateData(lat, lng);
        let weatherFactor = seasonalFactor;
        let weatherSummary = `Live Climate (${climate.source}): ${climate.temperature.toFixed(1)}°F, ${climate.relativeHumidity.toFixed(0)}% humidity, ${climate.conditionSummary}`;
        if (climate.relativeHumidity >= 70) {
            weatherFactor *= 1.18;
            weatherSummary += ` | High humidity accelerating pest emergence`;
        }
        else if (climate.relativeHumidity <= 35) {
            weatherFactor *= 1.05;
            weatherSummary += ` | Low humidity driving pests to indoor water sources`;
        }
        if (climate.temperature >= 85) {
            weatherFactor *= 1.22;
            weatherSummary += ` | High heat index driving subterranean swarming`;
        }
        else if (climate.temperature <= 50) {
            weatherFactor *= 1.15;
            weatherSummary += ` | Low outdoor temp driving rodent/roach intrusion`;
        }
        else {
            weatherFactor *= 1.10;
        }
        if (climate.precipitation >= 0.20) {
            chemicalDecayFactor *= 1.25;
            weatherSummary += ` | Rainfall (${climate.precipitation.toFixed(2)} in) degrading exterior barrier`;
        }
        // 4. Target pest determination & base severity
        let primaryTargetPest = 'Carpenter Ants';
        let pestBaseRisk = 35;
        if (latestLog?.targetPests && Array.isArray(latestLog.targetPests) && latestLog.targetPests.length > 0) {
            primaryTargetPest = String(latestLog.targetPests[0]);
        }
        const pestUpper = primaryTargetPest.toUpperCase();
        if (pestUpper.includes('TERMITE')) {
            pestBaseRisk = 48;
            primaryTargetPest = 'Subterranean Termites';
        }
        else if (pestUpper.includes('ROACH') || pestUpper.includes('COCKROACH')) {
            pestBaseRisk = 38;
            primaryTargetPest = 'German Cockroaches';
        }
        else if (pestUpper.includes('RODENT') || pestUpper.includes('MOUSE') || pestUpper.includes('RAT')) {
            pestBaseRisk = 42;
            primaryTargetPest = 'Rodents (Mice/Rats)';
        }
        else if (pestUpper.includes('WASP') || pestUpper.includes('HORNET')) {
            pestBaseRisk = 30;
            primaryTargetPest = 'Paper Wasps';
        }
        // 5. Property condition vulnerability from inspection photo tags
        let propertyVulnerabilityPoints = 0;
        let vulnerabilitySummary = 'Standard perimeter';
        const allTags = property.photos.flatMap(p => (Array.isArray(p.tags) ? p.tags : []));
        if (allTags.some(t => String(t).toLowerCase().includes('moisture') || String(t).toLowerCase().includes('water'))) {
            propertyVulnerabilityPoints += 15;
            vulnerabilitySummary = 'Elevated moisture intrusion observed';
        }
        if (allTags.some(t => String(t).toLowerCase().includes('wood') || String(t).toLowerCase().includes('rot'))) {
            propertyVulnerabilityPoints += 20;
            vulnerabilitySummary = 'Wood rot & structural decay present';
        }
        // 6. Calculate overall score (0 to 100)
        const rawScore = (pestBaseRisk * chemicalDecayFactor * weatherFactor) + propertyVulnerabilityPoints;
        const overallRiskScore = Math.min(98, Math.max(15, Math.round(rawScore)));
        // 7. Resurgence probability & days to projected resurgence
        const resurgenceProbability = Math.min(99.0, Number((overallRiskScore * 0.94).toFixed(2)));
        const daysToProjectedResurgence = Math.max(4, Math.round((100 - overallRiskScore) * 0.55));
        // 8. Risk Level tier
        let riskLevel = 'LOW';
        if (overallRiskScore >= 85)
            riskLevel = 'CRITICAL';
        else if (overallRiskScore >= 70)
            riskLevel = 'HIGH';
        else if (overallRiskScore >= 40)
            riskLevel = 'MEDIUM';
        // 9. Recommendations
        const recommendedTreatment = overallRiskScore >= 70
            ? `Immediate Exterior Perimeter Barrier Re-Application (${latestLog?.chemicalName || 'Bifenthrin 0.06%'}) with crawlspace/void dusting.`
            : `Routine preventative perimeter booster within the next ${daysToProjectedResurgence} days.`;
        const upsellRecommendation = pestUpper.includes('TERMITE') || propertyVulnerabilityPoints >= 15
            ? 'Annual Termite Bait Station Monitoring & Sub-Slab Moisture Barrier Installation.'
            : 'Quarterly Interior/Exterior Pest Defense Bundle with Rodent Bait Station Upgrade.';
        // Persist or upsert cached score
        await prisma.propertyPestRiskScore.create({
            data: {
                tenantId,
                propertyId,
                overallRiskScore,
                riskLevel,
                primaryTargetPest,
                resurgenceProbability,
                daysToProjectedResurgence,
                weatherRiskFactor: Number(weatherFactor.toFixed(2)),
                chemicalDecayFactor: Number(chemicalDecayFactor.toFixed(2)),
                seasonalVector,
                recommendedTreatment,
                upsellRecommendation,
                calculatedAt: now
            }
        });
        return {
            propertyId,
            address: property.address,
            lat,
            lng,
            overallRiskScore,
            riskLevel,
            primaryTargetPest,
            resurgenceProbability,
            daysToProjectedResurgence,
            weatherRiskFactor: Number(weatherFactor.toFixed(2)),
            chemicalDecayFactor: Number(chemicalDecayFactor.toFixed(2)),
            seasonalVector,
            recommendedTreatment,
            upsellRecommendation,
            factors: {
                daysSinceLastTreatment,
                lastChemicalUsed: latestLog?.chemicalName || 'None logged (unprotected)',
                weatherConditionSummary: weatherSummary,
                propertyVulnerability: vulnerabilitySummary,
                temperature: climate.temperature,
                humidity: climate.relativeHumidity,
                precipitation: climate.precipitation,
                windSpeed: climate.windSpeed,
                climateSource: climate.source,
            }
        };
    }
    /**
     * Generate geo-spatial heatmap data across all properties in tenant
     */
    static async getHeatmapData(tenantId) {
        const properties = await prisma.property.findMany({
            include: {
                pestRiskScores: {
                    take: 1,
                    orderBy: { calculatedAt: 'desc' }
                }
            }
        });
        const heatmapPoints = await Promise.all(properties.map(async (p, idx) => {
            let score = p.pestRiskScores[0];
            // If not yet calculated, calculate dynamically
            if (!score) {
                const calculated = await this.calculatePropertyRisk(p.id, tenantId);
                return {
                    propertyId: p.id,
                    address: p.address,
                    lat: calculated.lat || (39.7817 + (idx * 0.002)),
                    lng: calculated.lng || (-89.6501 + (idx * 0.002)),
                    overallRiskScore: calculated.overallRiskScore,
                    riskLevel: calculated.riskLevel,
                    primaryTargetPest: calculated.primaryTargetPest,
                    resurgenceProbability: calculated.resurgenceProbability,
                    daysToProjectedResurgence: calculated.daysToProjectedResurgence,
                    recommendedTreatment: calculated.recommendedTreatment,
                    upsellRecommendation: calculated.upsellRecommendation
                };
            }
            return {
                propertyId: p.id,
                address: p.address,
                lat: p.lat ? Number(p.lat) : (39.7817 + (idx * 0.002)),
                lng: p.lng ? Number(p.lng) : (-89.6501 + (idx * 0.002)),
                overallRiskScore: score.overallRiskScore,
                riskLevel: score.riskLevel,
                primaryTargetPest: score.primaryTargetPest,
                resurgenceProbability: Number(score.resurgenceProbability),
                daysToProjectedResurgence: score.daysToProjectedResurgence,
                recommendedTreatment: score.recommendedTreatment,
                upsellRecommendation: score.upsellRecommendation
            };
        }));
        return heatmapPoints;
    }
}
exports.PestRiskService = PestRiskService;
