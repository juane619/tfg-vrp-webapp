// General


// Create map with Mapbox
mapboxgl.accessToken = accessToken;
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-3.703790, 40.416775],
    zoom: 9
});

// create a mapboxClient to use Geocoding API service (creator of requests)
var mapboxClient = mapboxSdk({ accessToken: mapboxgl.accessToken });

// Add navigation control in top-rigth position
map.addControl(new mapboxgl.NavigationControl());

// GEolocation
if (navigator.geolocation) {
    // Add geolocate control to the map.
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true
    }));
} else {
    alert("Geolocation not supported or not allowed.")
}

// END GEolocation

/* ADD points and save coordinates */
var distanceContainer = document.getElementById('pruebas-mapa');

var geojsonPoints = {
    "type": "FeatureCollection",
    "features": []
}

map.on('load', function () {
    console.log("Mapa cargado..");

    // Add the source geojsonPoints
    map.addSource('geojsonPoints', {
        "type": "geojson",
        "data": geojsonPoints
    });

    // Add style to geojsonPoints source
    map.addLayer({
        id: 'node-points',
        type: 'circle',
        source: 'geojsonPoints',
        paint: {
            'circle-radius': 5,
            'circle-color': '#000'
        },
        filter: ['in', '$type', 'Point']
    });

    map.on('click', function (e) {
        // get point features of selected area (point mouse)
        var pointFeatures = map.queryRenderedFeatures(e.point, { layers: ['node-points'] });

        if (pointFeatures.length) {
            console.log("-------> FEature clicked!");
        } else {
            mapboxClient.geocoding.reverseGeocode({
                query: [e.lngLat.lng, e.lngLat.lat],
                limit: 1
            })
                .send()
                .then(response => {
                    const match = response.body;
                    if (match.features.length) {
                        var point = {
                            "type": "Feature",
                            "geometry": {
                                "type": "Point",
                                "coordinates": [
                                    e.lngLat.lng,
                                    e.lngLat.lat
                                ]
                            },
                            "properties": {
                                "id": String(new Date().getTime()),
                                "direction": match.features[0].place_name
                            }
                        };

                        geojsonPoints.features.push(point);
                        map.getSource('geojsonPoints').setData(geojsonPoints);

                        // Actualizamos tabla de direcciones
                        $('#table-parameters tbody tr:nth-child(' + (filledAdresses + 1) + ') td:nth-child(3) input#row-' + (filledAdresses + 1) + '-addresses').focus();
                        $('#table-parameters tbody tr:nth-child(' + ((filledAdresses + 1)) + ') td:nth-child(3) input#row-' + (filledAdresses + 1) + '-addresses').val(match.features[0].place_name);
                        $('#table-parameters tbody tr:nth-child(' + (filledAdresses + 1) + ') td:nth-child(4) input#row-' + (filledAdresses + 1) + '-srv').focus();
                        console.log("Filled rows: " + filledAdresses);
                    }
                });
        }


    });

    map.on('mousemove', function (e) {
        var features = map.queryRenderedFeatures(e.point, { layers: ['node-points'] });
        // UI indicator for clicking/hovering a point on the map
        map.getCanvas().style.cursor = (features.length) ? 'pointer' : 'crosshair';
    });

    map.on('drag', function (e) {
        map.getCanvas().style.cursor = 'pointer';
    });
});



/* END add points and save coordinates */