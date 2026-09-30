import https from 'https';

export interface ClimateData {
  latitude: number;
  longitude: number;
  temperature: number;
  temperatureUnit: string;
  relativeHumidity: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  conditionSummary: string;
  pestActivityImpact: string;
  source: string;
  cached: boolean;
}

interface CacheEntry {
  data: ClimateData;
  expiresAt: number;
}

const climateCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class ClimateService {
  /**
   * Translates WMO weather code into readable condition summary
   */
  static getWeatherDescription(code: number): string {
    if (code === 0) return 'Clear Sky';
    if (code === 1) return 'Mainly Clear';
    if (code === 2) return 'Partly Cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Fog / Deposition Fog';
    if (code >= 51 && code <= 55) return 'Drizzle';
    if (code >= 61 && code <= 65) return 'Rain (Sustained)';
    if (code >= 71 && code <= 77) return 'Snow / Freezing Precipitation';
    if (code >= 80 && code <= 82) return 'Rain Showers';
    if (code >= 95 && code <= 99) return 'Thunderstorm';
    return 'Ambient Weather';
  }

  /**
   * Generates dynamic pest activity impact description based on climate metrics
   */
  static evaluatePestImpact(temp: number, humidity: number, rain: number, wind: number): string {
    const notes: string[] = [];

    if (temp >= 85) {
      notes.push(`Excessive heat (${temp.toFixed(1)}°F) forces subterranean termites, fire ants, and wasps into active swarming`);
    } else if (temp <= 50) {
      notes.push(`Low ambient temperature (${temp.toFixed(1)}°F) drives rodents and cockroaches to seek warmth and harborage indoors`);
    } else {
      notes.push(`Optimal temperature range (${temp.toFixed(1)}°F) supports aggressive surface foraging`);
    }

    if (humidity >= 70) {
      notes.push(`High relative humidity (${humidity.toFixed(0)}%) accelerates spore/fungal growth and shortens pest reproductive cycles`);
    } else if (humidity <= 35) {
      notes.push(`Low humidity (${humidity.toFixed(0)}%) triggers pest searches for indoor plumbing and structural moisture`);
    }

    if (rain >= 0.25) {
      notes.push(`Recent precipitation (${rain.toFixed(2)} in) degrades perimeter chemical barriers and saturates nesting burrows`);
    }

    if (wind >= 15) {
      notes.push(`High winds (${wind.toFixed(1)} mph) limit flying pest dispersal and cause clustering at foundation wall bases`);
    }

    return notes.join('. ') + '.';
  }

  /**
   * Provides deterministic fallback climate data if offline or unreachable
   */
  static getFallbackClimate(lat: number, lng: number): ClimateData {
    const month = new Date().getMonth();
    let baseTemp = 72.0;
    let baseHumidity = 55.0;

    if (month >= 5 && month <= 7) {
      baseTemp = 86.0;
      baseHumidity = 65.0;
    } else if (month >= 11 || month <= 1) {
      baseTemp = 42.0;
      baseHumidity = 45.0;
    }

    const conditionSummary = this.getWeatherDescription(1);
    const pestActivityImpact = this.evaluatePestImpact(baseTemp, baseHumidity, 0.0, 6.0);

    return {
      latitude: lat,
      longitude: lng,
      temperature: baseTemp,
      temperatureUnit: 'fahrenheit',
      relativeHumidity: baseHumidity,
      precipitation: 0.0,
      windSpeed: 6.0,
      weatherCode: 1,
      conditionSummary,
      pestActivityImpact,
      source: 'offline-ambient-fallback',
      cached: false,
    };
  }

  /**
   * Fetches real-time climate data from Open-Meteo API with caching and fallback
   */
  static async getClimateData(lat: number, lng: number): Promise<ClimateData> {
    const roundedLat = Number(lat.toFixed(3));
    const roundedLng = Number(lng.toFixed(3));
    const cacheKey = `${roundedLat},${roundedLng}`;

    const cached = climateCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.data, cached: true };
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${roundedLat}&longitude=${roundedLng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;

    return new Promise<ClimateData>((resolve) => {
      const req = https.get(url, { timeout: 3500 }, (res) => {
        if (res.statusCode !== 200) {
          const fallback = this.getFallbackClimate(roundedLat, roundedLng);
          return resolve(fallback);
        }

        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            const current = parsed.current;
            if (!current) {
              return resolve(this.getFallbackClimate(roundedLat, roundedLng));
            }

            const temp = Number(current.temperature_2m ?? 72);
            const humidity = Number(current.relative_humidity_2m ?? 50);
            const precipitation = Number(current.precipitation ?? 0);
            const windSpeed = Number(current.wind_speed_10m ?? 5);
            const weatherCode = Number(current.weather_code ?? 0);

            const conditionSummary = this.getWeatherDescription(weatherCode);
            const pestActivityImpact = this.evaluatePestImpact(temp, humidity, precipitation, windSpeed);

            const result: ClimateData = {
              latitude: roundedLat,
              longitude: roundedLng,
              temperature: temp,
              temperatureUnit: 'fahrenheit',
              relativeHumidity: humidity,
              precipitation,
              windSpeed,
              weatherCode,
              conditionSummary,
              pestActivityImpact,
              source: 'open-meteo',
              cached: false,
            };

            climateCache.set(cacheKey, {
              data: result,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });

            resolve(result);
          } catch {
            resolve(this.getFallbackClimate(roundedLat, roundedLng));
          }
        });
      });

      req.on('error', () => resolve(this.getFallbackClimate(roundedLat, roundedLng)));
      req.on('timeout', () => {
        req.destroy();
        resolve(this.getFallbackClimate(roundedLat, roundedLng));
      });
    });
  }
}
