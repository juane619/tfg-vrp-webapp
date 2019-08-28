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

geojsonPoints = {
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

        if ($("#tabs-sections a[href='#addresses'].active").length == 0) {
            $("#tabs-sections a[href='#addresses']").click();
        }
        // get point features of selected area (point mouse)
        var pointFeatures = map.queryRenderedFeatures(e.point, { layers: ['node-points'] });

        if (pointFeatures.length) {
            console.log("-------> FEature clicked!" + pointFeatures[0].layer.paint['circle-radius'])
            pointFeatures[0].layer.paint['circle-radius'] = 50;
            console.log("-------> FEature clicked!" + pointFeatures[0].layer.paint['circle-radius'])
            map.getSource('geojsonPoints').setData(geojsonPoints);
            console.log(pointFeatures[0]);
            console.log(geojsonPoints);

            map.flyTo({
                center: [
                    geojsonPoints.features[pointFeatures[0].properties['table-position'] - 1].geometry.coordinates[0],
                    geojsonPoints.features[pointFeatures[0].properties['table-position'] - 1].geometry.coordinates[1]]
            });
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
                                "direction": match.features[0].place_name,
                                "table-position": filledAdresses + 1
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

    // Create a popup, but don't add it to the map yet.
    popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    popup2 = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true
    });

    // When a mouse enter event occurs on a feature in the places layer, open a popup at the
    // location of the feature, with description HTML from its properties.
    map.on('mouseenter', 'node-points', function (e) {
        var coordinates = e.features[0].geometry.coordinates.slice();
        var tablePosition = e.features[0].properties['table-position'];

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        popup.setLngLat(coordinates)
            .setHTML("table-position: " + tablePosition)
            .addTo(map);

        $('.selected').removeClass('selected');
        $('#table-parameters > tbody > tr:nth-child(' + tablePosition + ')').addClass("selected");
    });

    map.on('mouseleave', 'node-points', function () {
        map.getCanvas().style.cursor = '';
        popup.remove();
        $('#table-parameters > tbody .selected').removeClass("selected");
    });

    // When a mouse enter event occurs on a feature in the places layer, open a popup at the
    // location of the feature, with description HTML from its properties.
    map.on('contextmenu', 'node-points', function (e) {
        var coordinates = e.features[0].geometry.coordinates.slice();
        var tablePosition = e.features[0].properties['table-position'];

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        coordinates_aux = [coordinates[0], coordinates[1] - 0.01];
        popup2.setLngLat(coordinates_aux)
            .setHTML("<div class='context-menu-item' id='delete-point" + tablePosition + "' style='cursor: pointer; white-space: nowrap;'>Delete</div>")
            .addTo(map);

        //$('.selected').removeClass('selected');
        //$('#table-parameters > tbody > tr:nth-child(' + tablePosition + ')').addClass("selected");
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