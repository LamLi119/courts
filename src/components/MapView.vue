<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import type { Venue, Language } from '../../types';
declare const google: any;

const courtIconUrl = `${import.meta.env.BASE_URL}green-G.svg`;

const props = defineProps<{
  venues: Venue[];
  selectedVenue: Venue | null;
  onSelectVenue: (v: Venue) => void;
  /** When pin is clicked, call with all venues at that location so the list can show only them. */
  onShowVenuesAtLocation?: (venues: Venue[]) => void;
  language: Language;
  darkMode: boolean;
  isMobile?: boolean;
}>();

const mapRef = ref<HTMLDivElement | null>(null);
const googleMap = ref<any>(null);
 /** Markers keyed by location key (lat,lng rounded) so one pin per same building. */
const markers = ref<Record<string, any>>({});
const infoWindow = ref<any>(null);
const mapError = ref<string | null>(null);

/** Same lat,lng (e.g. same building) => one pin. Round to 5 decimals to group. */
function getLocationKey(coords: { lat: number; lng: number }): string {
  const lat = Math.round(coords.lat * 1e5) / 1e5;
  const lng = Math.round(coords.lng * 1e5) / 1e5;
  return `${lat},${lng}`;
}

const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.station', elementType: 'labels.text', stylers: [{ visibility: 'on' }] }
];

const DARK_MODE_STYLE = [
  ...MAP_STYLES,
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] }
];

function initMap() {
  if (typeof google === 'undefined' || !google.maps || !mapRef.value || googleMap.value) return;
  try {
    googleMap.value = new google.maps.Map(mapRef.value, {
      center: props.isMobile ? { lat: 22.2499, lng: 114.1194 } : { lat: 22.3499, lng: 114.1194 },
      zoom: props.isMobile ? 10 : 11,
      disableDefaultUI: props.isMobile ? true : false,
      zoomControl: props.isMobile ? true : false,
      mapTypeControl: props.isMobile ? true : false,
      streetViewControl: props.isMobile ? true : false,
      fullscreenControl: props.isMobile ? true : false,
      styles: props.darkMode ? DARK_MODE_STYLE : MAP_STYLES
    });
  } catch (err) {
    console.error('Error initializing map:', err);
    mapError.value = 'Error initializing Google Maps. This usually means the API Key is restricted.';
  }
}

/** Load Google Maps script only when this component is mounted (deferred from main.ts for faster initial load). */
function loadGoogleMapsScript() {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string)?.trim();
  if (!apiKey) {
    console.error('VITE_GOOGLE_MAPS_API_KEY is not defined in .env');
    window.dispatchEvent(new Event('google-maps-auth-error'));
    return;
  }
  if (document.querySelector('script[src*="maps.googleapis.com"]')) return;

  (window as any).__onGoogleMapsLoaded = () => {
    window.dispatchEvent(new Event('google-maps-ready'));
  };
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=__onGoogleMapsLoaded`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    console.error('Failed to load Google Maps API');
    window.dispatchEvent(new Event('google-maps-auth-error'));
  };
  document.head.appendChild(script);
}

onMounted(() => {
  const handleAuthError = () => {
    mapError.value =
      "API Restricted: Please enable 'Maps JavaScript API' and 'Places API' for this key in Google Cloud Console.";
  };

  const onReady = () => initMap();

  window.addEventListener('google-maps-auth-error', handleAuthError as EventListener);
  window.addEventListener('google-maps-ready', onReady);

  if (typeof google !== 'undefined' && google.maps) {
    initMap();
  } else {
    mapError.value = null;
    loadGoogleMapsScript();
  }

  onBeforeUnmount(() => {
    window.removeEventListener('google-maps-auth-error', handleAuthError as EventListener);
    window.removeEventListener('google-maps-ready', onReady);
  });
});

const retryLoading = () => {
  window.location.reload();
};

const racquetPaths = `
<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	fill="none" width="100%" viewBox="0 0 500 500" xml:space="preserve">
<path opacity="1.000000" stroke="none" 
	d="
M315.000000,501.000000 
	C210.000031,501.000000 105.500053,501.000000 1.000056,501.000000 
	C1.000037,334.333405 1.000037,167.666794 1.000019,1.000146 
	C167.666565,1.000097 334.333130,1.000097 500.999756,1.000049 
	C500.999847,167.666519 500.999847,334.333038 500.999939,500.999786 
	C439.166656,501.000000 377.333344,501.000000 315.000000,501.000000 
M251.480865,223.111694 
	C251.376129,223.400436 251.271393,223.689194 250.790909,224.720032 
	C250.081116,229.710709 249.371628,234.701447 248.661484,239.692062 
	C247.441376,248.266571 246.182373,256.835754 245.010880,265.416870 
	C243.730576,274.795044 242.531082,284.184296 241.237106,294.019043 
	C254.348541,294.019043 267.445282,294.019043 280.844330,294.019043 
	C280.844330,297.410217 281.140472,300.394287 280.789825,303.300293 
	C279.654236,312.711823 278.072296,322.073090 277.099579,331.498871 
	C276.694122,335.427643 275.315613,337.578644 271.533600,339.089874 
	C257.444458,344.719513 242.755341,346.187042 227.931046,344.807831 
	C218.113251,343.894379 209.180511,340.350739 202.755737,331.630615 
	C195.195786,321.369781 192.782761,309.708160 192.107956,297.614899 
	C190.880905,275.624817 193.891342,253.899887 196.846313,232.141449 
	C199.486832,212.698486 202.832581,193.499908 210.095642,175.218536 
	C214.426529,164.317520 220.583252,154.442062 230.253036,147.401825 
	C241.517365,139.200653 254.694794,137.827820 267.872101,139.362595 
	C273.812317,140.054459 280.032471,143.168396 284.948608,146.783813 
	C294.070984,153.492554 295.390198,164.257523 295.844330,174.599106 
	C296.242401,183.664139 295.304993,192.787811 294.401642,202.143082 
	C294.601349,202.706497 294.801025,203.269928 295.928741,203.973282 
	C322.623199,203.926636 349.317657,203.879990 376.519135,203.888306 
	C376.623871,203.599564 376.728607,203.310806 377.213470,202.274673 
	C378.475555,191.565872 380.236725,180.886505 380.870819,170.140640 
	C381.628174,157.305344 380.293152,144.539124 377.012665,132.028275 
	C372.082397,113.225891 362.061920,97.871429 345.833221,87.024590 
	C327.276428,74.621704 306.132935,69.411888 284.325684,68.257011 
	C262.462097,67.099152 240.476974,67.099136 218.924652,72.917542 
	C198.331253,78.477081 180.064270,87.933632 164.704849,102.806129 
	C151.580887,115.514046 142.333130,130.742645 134.806442,147.311539 
	C126.404671,165.806793 120.745903,185.059875 117.065575,204.925491 
	C114.984734,216.157455 113.421173,227.497589 111.996727,238.835754 
	C110.138245,253.628723 107.940712,268.431335 107.170799,283.296204 
	C106.095856,304.050903 107.965317,324.610718 113.915085,344.748138 
	C121.367264,369.970490 135.803375,389.460205 159.101456,401.992310 
	C178.685974,412.526886 200.058197,416.056061 221.914780,416.878693 
	C231.984329,417.257660 242.152512,416.845337 252.186676,415.871643 
	C264.694489,414.657867 277.352692,413.488739 289.512543,410.523224 
	C311.382019,405.189728 331.191498,395.085114 349.220673,381.449890 
	C353.173553,378.460388 354.595123,374.906006 354.985779,370.447662 
	C355.088867,366.954529 354.934174,368.102509 355.088867,366.954529 
	C356.703949,354.969116 358.396332,342.994080 359.988129,331.005646 
	C361.108612,322.567047 362.049316,314.104523 363.175812,305.666779 
	C364.386444,296.598938 365.740021,287.550293 366.994843,278.488251 
	C368.228210,269.581085 369.486725,260.676483 370.604065,251.754440 
	C371.761871,242.509109 372.763428,233.244202 373.888275,223.480820 
	C373.599518,223.376099 373.310760,223.271378 372.091095,223.026733 
	C332.056702,223.073380 292.022278,223.120026 251.480865,223.111694 
z"/>
<path fill="#00E091" opacity="1.000000" stroke="none" 
	d="
M376.012115,203.833344 
	C349.317657,203.879990 322.623199,203.926636 295.460754,203.578613 
	C294.981018,202.751160 294.969238,202.318375 294.957489,201.885590 
	C295.304993,192.787811 296.242401,183.664139 295.844330,174.599106 
	C295.390198,164.257523 294.070984,153.492554 284.948608,146.783813 
	C280.032471,143.168396 273.812317,140.054459 267.872101,139.362595 
	C254.694794,137.827820 241.517365,139.200653 230.253036,147.401825 
	C220.583252,154.442062 214.426529,164.317520 210.095642,175.218536 
	C202.832581,193.499908 199.486832,212.698486 196.846313,232.141449 
	C193.891342,253.899887 190.880905,275.624817 192.107956,297.614899 
	C192.782761,309.708160 195.195786,321.369781 202.755737,331.630615 
	C209.180511,340.350739 218.113251,343.894379 227.931046,344.807831 
	C242.755341,346.187042 257.444458,344.719513 271.533600,339.089874 
	C275.315613,337.578644 276.694122,335.427643 277.099579,331.498871 
	C278.072296,322.073090 279.654236,312.711823 280.789825,303.300293 
	C281.140472,300.394287 280.844330,297.410217 280.844330,294.019043 
	C267.445282,294.019043 254.348541,294.019043 241.237106,294.019043 
	C242.531082,284.184296 243.730576,274.795044 245.010880,265.416870 
	C246.182373,256.835754 247.441376,248.266571 248.661484,239.692062 
	C249.371628,234.701447 250.081116,229.710709 251.126297,224.224823 
	C251.652008,223.555939 251.827408,223.368286 251.987869,223.166656 
	C292.022278,223.120026 332.056702,223.073380 372.680725,223.244202 
	C373.444061,223.652023 373.631714,223.827408 373.833344,223.987854 
	C372.763428,233.244202 371.761871,242.509109 370.604065,251.754440 
	C369.486725,260.676483 368.228210,269.581085 366.994843,278.488251 
	C365.740021,287.550293 364.386444,296.598938 363.175812,305.666779 
	C362.049316,314.104523 361.108612,322.567047 359.988129,331.005646 
	C358.396332,342.994080 356.703949,354.969116 355.088867,366.954529 
	C354.934174,368.102509 355.087341,369.288879 354.985779,370.447662 
	C354.595123,374.906006 353.173553,378.460388 349.220673,381.449890 
	C331.191498,395.085114 311.382019,405.189728 289.512543,410.523224 
	C277.352692,413.488739 264.694489,414.657867 252.186676,415.871643 
	C242.152512,416.845337 231.984329,417.257660 221.914780,416.878693 
	C200.058197,416.056061 178.685974,412.526886 159.101456,401.992310 
	C135.803375,389.460205 121.367264,369.970490 113.915085,344.748138 
	C107.965317,324.610718 106.095856,304.050903 107.170799,283.296204 
	C107.940712,268.431335 110.138245,253.628723 111.996727,238.835754 
	C113.421173,227.497589 114.984734,216.157455 117.065575,204.925491 
	C120.745903,185.059875 126.404671,165.806793 134.806442,147.311539 
	C142.333130,130.742645 151.580887,115.514046 164.704849,102.806129 
	C180.064270,87.933632 198.331253,78.477081 218.924652,72.917542 
	C240.476974,67.099136 262.462097,67.099152 284.325684,68.257011 
	C306.132935,69.411888 327.276428,74.621704 345.833221,87.024590 
	C362.061920,97.871429 372.082397,113.225891 377.012665,132.028275 
	C380.293152,144.539124 381.628174,157.305344 380.870819,170.140640 
	C380.236725,180.886505 378.475555,191.565872 376.875916,202.772522 
	C376.348022,203.444077 376.172607,203.631729 376.012115,203.833344 
z"/>
</svg>
`;

const markerIconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
          fill="#007a67"
          stroke="#ffffff"
          stroke-width="1" />
    <g transform="translate(6, 4) scale(0.5)" fill="#ffffff" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
      ${racquetPaths}
    </g>
  </svg>
`)}`;

// Valid ranges: lat -90..90, lng -180..180 (Hong Kong ~22.3, 114.1)
const isValidLat = (n: number) => typeof n === 'number' && !Number.isNaN(n) && n >= -90 && n <= 90;
const isValidLng = (n: number) => typeof n === 'number' && !Number.isNaN(n) && n >= -180 && n <= 180;

const normalizeLatLng = (coords: any): { lat: number; lng: number } | null => {
  if (!coords) return null;

  let lat: number;
  let lng: number;

  // GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
  if (coords.type === 'Point' && Array.isArray(coords.coordinates) && coords.coordinates.length >= 2) {
    lng = typeof coords.coordinates[0] === 'string' ? parseFloat(coords.coordinates[0]) : coords.coordinates[0];
    lat = typeof coords.coordinates[1] === 'string' ? parseFloat(coords.coordinates[1]) : coords.coordinates[1];
  }
  // Plain { lat, lng } or { latitude, longitude }
  else if (('lat' in coords && 'lng' in coords) || ('latitude' in coords && 'longitude' in coords)) {
    lat = typeof (coords.lat ?? coords.latitude) === 'string' ? parseFloat(coords.lat ?? coords.latitude) : (coords.lat ?? coords.latitude);
    lng = typeof (coords.lng ?? coords.longitude) === 'string' ? parseFloat(coords.lng ?? coords.longitude) : (coords.lng ?? coords.longitude);
  }
  // Array: [lat, lng] or [lng, lat] — infer by valid ranges
  else if (Array.isArray(coords) && coords.length >= 2) {
    const a = typeof coords[0] === 'string' ? parseFloat(coords[0]) : coords[0];
    const b = typeof coords[1] === 'string' ? parseFloat(coords[1]) : coords[1];
    if (isValidLat(a) && isValidLng(b)) {
      lat = a;
      lng = b;
    } else if (isValidLng(a) && isValidLat(b)) {
      lng = a;
      lat = b;
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (!isValidLat(lat) || !isValidLng(lng)) {
    // Common mistake: lat/lng swapped (e.g. HK would become lat 114, lng 22)
    if (isValidLat(lng) && isValidLng(lat)) {
      [lat, lng] = [lng, lat];
    } else {
      return null;
    }
  }
  return { lat, lng };
};

const clearAllMarkers = () => {
  if (infoWindow.value) {
    try { infoWindow.value.close(); } catch { /* ignore */ }
    infoWindow.value = null;
  }
  Object.values(markers.value).forEach((m) => {
    try {
      if (typeof m?.setVisible === 'function') m.setVisible(false);
      m.setMap(null);
    } catch {
      // ignore
    }
  });
  markers.value = {};
};

const syncMarkers = () => {
  if (!googleMap.value || typeof google === 'undefined') return;
  clearAllMarkers();

  // Group venues by same lat,lng (same building) so we show one pin per location.
  const groups = new Map<string, typeof props.venues>();
  props.venues.forEach((venue) => {
    const coords = normalizeLatLng((venue as any).coordinates);
    if (!coords) return;
    const key = getLocationKey(coords);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(venue);
  });

  groups.forEach((venueList, locationKey) => {
    const venue = venueList[0];
    const coords = normalizeLatLng((venue as any).coordinates);
    if (!coords) return;

    const title =
      venueList.length > 1
        ? venueList.map((v) => v.name).join(', ')
        : venue.name;

    const marker = new google.maps.Marker({
      position: coords,
      map: googleMap.value,
      title,
      icon: {
        url: markerIconUrl,
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 48)
      },
      animation: google.maps.Animation.DROP
    });

    marker.addListener('click', () => {
      // Always tell parent to show these venues on the list (filter side).
      props.onShowVenuesAtLocation?.(venueList);
      if (venueList.length > 1) {
        // Same building: show InfoWindow with all venues on one line (X venues here) and list to pick one.
        if (infoWindow.value) infoWindow.value.close();
        infoWindow.value = new google.maps.InfoWindow();
        const div = document.createElement('div');
        div.className = 'map-info-window';
        div.style.cssText = 'padding:4px 0;min-width:140px;max-width:260px;';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:700;font-size:12px;color:#4b5563;margin-bottom:8px;white-space:nowrap;';
        title.textContent = props.language === 'zh' ? `此位置 ${venueList.length} 個場地` : `${venueList.length} venues here`;
        div.appendChild(title);
        venueList.forEach((v: Venue) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = v.name;
          btn.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 12px;font-size:14px;font-weight:700;border:none;background:transparent;cursor:pointer;border-radius:8px;';
          btn.addEventListener('click', () => {
            props.onSelectVenue(v);
            if (infoWindow.value) infoWindow.value.close();
          });
          btn.addEventListener('mouseenter', () => { btn.style.background = '#007a67'; btn.style.color = '#fff'; });
          btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.color = ''; });
          div.appendChild(btn);
        });
        infoWindow.value.setContent(div);
        infoWindow.value.open(googleMap.value, marker);
      } else {
        props.onSelectVenue(venueList[0]);
      }
    });
    markers.value[locationKey] = marker;
  });
};

const fitToAllVenues = () => {
  if (!googleMap.value || typeof google === 'undefined') return;
  const visibleMarkers = Object.values(markers.value).filter(Boolean) as any[];
  if (visibleMarkers.length === 0) {
    // Fallback to default HK view
    googleMap.value.setCenter(props.isMobile ? { lat: 22.2499, lng: 114.1194 } : { lat: 22.3499, lng: 114.1194 });
    googleMap.value.setZoom(props.isMobile ? 10 : 11);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  visibleMarkers.forEach((m) => {
    if (typeof m.getPosition === 'function') {
      const pos = m.getPosition();
      if (pos) bounds.extend(pos);
    }
  });
  if (bounds.isEmpty()) return;
  googleMap.value.fitBounds(bounds);
  // Prevent zooming in too far when courts are very close
  google.maps.event.addListenerOnce(googleMap.value, 'bounds_changed', () => {
    const targetZoom = props.isMobile ? 10 : 11;
    if (googleMap.value.getZoom() > targetZoom) {
      googleMap.value.setZoom(targetZoom);
    }
  });
};

// Allow parent components to force clear/re-sync pins (e.g. on "Go search")
defineExpose({
  clearPins: async () => {
    clearAllMarkers();
    // Wait for browser paint so user sees pins disappear immediately.
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      } else {
        resolve();
      }
    });
  },
  syncPins: () => syncMarkers(),
  resetView: () => fitToAllVenues()
});

watch(
  () => props.darkMode,
  (value) => {
    if (googleMap.value) {
      googleMap.value.setOptions({
        styles: value ? DARK_MODE_STYLE : MAP_STYLES
      });
    }
  }
);

// Create a computed that generates a unique key for the venues array
const venuesKey = computed(() => {
  if (!props.venues || props.venues.length === 0) return 'empty';
  return props.venues.map(v => v.id).sort((a, b) => a - b).join(',');
});

watch(
  venuesKey,
  () => {
    if (googleMap.value) {
      // Always sync markers when venues change (by ID list)
      syncMarkers();
    }
  },
  { immediate: true }
);

watch(
  () => googleMap.value,
  () => {
    if (googleMap.value && props.venues) {
      syncMarkers();
    }
  }
);

watch(
  () => props.selectedVenue,
  (selected) => {
    if (selected && googleMap.value && typeof google !== 'undefined') {
      const pos = normalizeLatLng((selected as any).coordinates);
      if (pos) {
        googleMap.value.panTo(pos);
      }
      googleMap.value.setZoom(15);
      Object.values(markers.value).forEach((m) => m.setAnimation(null));
      const locationKey = pos ? getLocationKey(pos) : null;
      const selectedMarker = locationKey ? markers.value[locationKey] : null;
      if (selectedMarker) {
        selectedMarker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => selectedMarker.setAnimation(null), 1500);
      }
    }
  }
);
</script>

<template>
  <div
    v-if="mapError"
    class="w-full h-full flex flex-col items-center justify-center p-8 text-center transition-colors"
    :class="darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'"
  >
    <div class="text-6xl mb-6 opacity-30">🗺️</div>
    <h3 class="text-xl font-black mb-2">
      {{ language === 'en' ? 'Map Unavailable' : '地圖目前無法顯示' }}
    </h3>
    <p class="text-sm max-w-xs mx-auto leading-relaxed">
      {{ mapError }}
    </p>
    <div class="mt-8 flex flex-col gap-2">
      <button
        class="px-6 py-3 rounded-lg font-black text-xs transition-all active:scale-95"
        :class="darkMode ? 'bg-gray-700 text-white' : 'bg-white shadow-md text-gray-900'"
        @click="retryLoading"
      >
        {{ language === 'en' ? 'RETRY LOADING' : '重新整理' }}
      </button>
      <a
        href="https://developers.google.com/maps/documentation/javascript/error-messages#api-target-blocked-map-error"
        target="_blank"
        rel="noopener noreferrer"
        class="text-[10px] font-bold underline opacity-50 hover:opacity-100"
      >
        {{ language === 'en' ? 'Learn more about this error' : '了解更多關於此錯誤' }}
      </a>
    </div>
  </div>
  <div
    v-else
    ref="mapRef"
    class="w-full h-full bg-gray-200"
  />
</template>

