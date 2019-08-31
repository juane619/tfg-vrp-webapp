// TABLE
var filledAdresses = 0;

var idLastRow = 4;

var lastContainerId = null
var lastContainerValue = null;

// capturamos el evento de clickar en un textbox diferente y detectar el cambio de valor
$(document).on('focus click', '#left-plan', function (e) {
    if (lastContainerId == null && e.target.className === 'address-textbox') { //si todavia no hemos clicado antes o hemos clicado fuera de un textbox y estamos pulsando en un textbox
        lastContainerId = e.target.id;
        lastContainerValue = e.target.value;
    } else if (lastContainerId != null) { // Si previamente hemos clickado en un textbox 
        if (!($("#" + lastContainerId).is(e.target))) { // si no clicamos en el mismo textbox
            var currentContainerValue = $("#" + lastContainerId).val();
            if (currentContainerValue !== lastContainerValue) { // si cambia de valor el penultimo elemento clickado
                // count filled addresses
                countFilledAddresses(currentContainerValue, lastContainerValue, lastContainerId);
                //console.log(filledAdresses);
            }
            // reiniciamos las variables referentes al ultimo elemento clicado segun donde cliquemos
            if (e.target.className === 'address-textbox') {
                lastContainerId = e.target.id;
                lastContainerValue = e.target.value;
            } else {
                lastContainerId = null
                lastContainerValue = null;
            }
        }
    } else if (e.target.className != 'address-textbox') { // SI no hemos clickado antes en un textbox (o en ningun sitio) y clickamos ahora fuera de un textbox
        // REseteamos variables referentes al ultimo elemento clicado
        lastContainerId = null
        lastContainerValue = null;
    }
});

$("#table-parameters").on('click', '.row_node', function () {
    $('.selected').removeClass('selected');
    $(this).addClass("selected");

    //console.log(geojsonPoints.features[$(this).index()].geometry.coordinates);

    popup.setLngLat(geojsonPoints.features[$(this).index()].geometry.coordinates)
        .setHTML("table-position: " + ($(this).index() + 1))
        .addTo(map);

    map.flyTo({
        center: [
            geojsonPoints.features[$(this).index()].geometry.coordinates[0],
            geojsonPoints.features[$(this).index()].geometry.coordinates[1]]
    });
});

function countFilledAddresses(current, last, targetId) {
    var nrows = $("#table-parameters tbody tr").length;

    if (last.length === 0) {
        filledAdresses++;
        if (filledAdresses >= 4 && filledAdresses >= nrows) {
            addRow();
        }
    }
    else if (current.length === 0) {
        if (filledAdresses > 0)
            filledAdresses--;
        if (nrows > 4) {
            removeRow(targetId);
        }
    }

    console.log("Filled addresses: " + filledAdresses);
}

// Add/remove una fila
function addRow() {
    //console.log("Adding row");
    idLastRow++;
    var markup = '<tr class="row_node">\
        <td scope="row">'+ idLastRow + '</td>\
        <td><input type="text" id="row-'+ idLastRow + '-title" name="row-' + idLastRow + '-title" placeholder="Title (optional)" value=""></td>\
        <td><input type="text" id="row-'+ idLastRow + '-addresses" class="address-textbox" name="row-' + idLastRow + '-addresses" placeholder="Start address" value=""></td>\
        <td><input type="number" min="0" max="24" id="row-'+ idLastRow + '-srv" name="row-' + idLastRow + '-srv" placeholder="0" value="0"></td>\
        <td><input type="number" id="row-'+ idLastRow + '-bsize" name="row-' + idLastRow + '-bsize" value="0"></td>\
        <td><input type="number" id="row-'+ idLastRow + '-dsize" name="row-' + idLastRow + '-dsize" value="0"></td>\
        <td><input type="time" min="06:00" max="20:00" id="row-'+ idLastRow + '-fromtime" name="row-' + idLastRow + '-fromtime" placeholder="06:00" value="06:00"></td>\
        <td><input type="time" min="06:00" max="20:00" id="row-'+ idLastRow + '-untiltime" name="row-' + idLastRow + '-untiltime" placeholder="20:00" value="20:00"></td>';
    $("#table-parameters tbody").append(markup);
}

function removeRow(targetId) {
    //console.log("removing row " + targetId);
    if (targetId.includes(idLastRow)) {
        idLastRow--;
    }
    $("#" + targetId).parents("tr").remove();
}

// Send inputs data
function sendProblemData(dataMatrix, problemData) {
    var errors = [];
    // https://github.com/mapbox/mapbox-sdk-js/blob/master/docs/services.md#getmatrix

    // Vemos los puntos elegidos por el usuario en consola
    //console.log(geojsonPoints);

    // Creamos el objeto myPoints que representa los nodos elegidos por el usuario
    var myPoints = {
        points: [],
        profile: 'driving',
        annotations: ["distance"]
    };

    // Rellenamos array de puntos del objeto myPoints
    geojsonPoints.features.forEach(element => {
        var point = { coordinates: element.geometry.coordinates };
        myPoints.points.push(point);
    });

    // Obtenemos mediante llamada a la API Mapbox la matriz de distancias entre los nodos elegidos

    mapboxClient.matrix.getMatrix(myPoints)
        .send()
        .then(response => {
            const matrix = response.body; //MAtriz de distancias
            //console.log(matrix);

            // Una vez tenemos la matriz de distancias, enviamos al server la matriz de distancias, de parametros y los parametros del problema al server
            // para crear el archivo de entrada al algoritmo
            // (enviamos csrf token de seguridad obtenida de la cookie)
            $.ajax({
                type: "POST",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                url: 'nodes-data',
                dataType: "json",
                data: {
                    'distance_matrix': JSON.stringify(matrix.distances),
                    'matrix_data': JSON.stringify(dataMatrix),
                    'problem_data': JSON.stringify(problemData)
                },
                success: function (response) {
                    //console.log(response);
                    var routesMatrix = response.routesMatrix;
                    manageMatrixRoutes(routesMatrix);
                },
                error: function (thrownError) {
                    manageMatrixRoutes(undefined);
                }
            });
        });
}

/* Manage matrix routes */

function manageMatrixRoutes(routesMatrix) {
    // clear format
    $("div#messagelist").removeClass("alert-danger");
    $("div#messagelist").removeClass("alert-warning");
    $("div#messagelist").removeClass("alert-success");
    $("div#messagelist").text("");

    if (routesMatrix) {
        if (routesMatrix.length == 0) {
            $("#message-save").addClass("d-none");
            $("div#messagelist").addClass("alert-warning");
            $("div#messagelist").text("Not routes obtained..");
        } else {
            $("#message-save").removeClass("d-none");
            // 1. send to Mapbox API AND 2. MODIFY TABLE PARAMETERS


            // 2. MODIFY TABLE PARAMETERS
            // reset routes table and routes tabs
            $("#table-routes tbody").empty();
            $("#tabs-routes ul li a[href='#summary']").parent().siblings().empty(); //delete tabs of routes

            for (var i = 0; i < routesMatrix.length; i++) {
                var randomColor = getRandomColor();

                // 1. PRINT ROUTES IN MAP
                routesMatrixData = sendRoutesMatrixToMapboxAPI(routesMatrix[i], randomColor, i);

                var markup = '\
                    <tr style="background-color: '+ randomColor + '">\
                        <th scope="row"><a href="#route'+ (i + 1) + '">Route #' + (i + 1) + '</a></th>\
                        <td>' + (routesMatrix[i].length - 2) + ' clients</td>\
                        <td>0:07</td>\
                        <td>1.01 miles</td>\
                        <td><input type="button" value="Zoom" class="zoomButton" title="Center the map on this route"></td>\
                    </tr>';

                $("#table-routes tbody").append(markup);

                $("#table-routes tbody a[href='#route" + (i + 1) + "']").click(function (e) {
                    var href = $(this).attr("href");
                    $("#tabs-routes a[href='" + href + "']").click();
                })

                // route tabs

                // add tab and related route nodes
                addRouteNodes(i + 1, routesMatrix[i], randomColor);


            }
        }
    } else {
        $("div#messagelist").addClass("alert-danger");
        $("#messagelist").text("Algorithms fails....");
    }
}

function sendRoutesMatrixToMapboxAPI(route, randomColor, id) {
    if (route.length) {
        truckLocation = [geojsonPoints.features[route[0]].geometry.coordinates];
        warehouseLocation = [geojsonPoints.features[route[0]].geometry.coordinates];
        lastQueryTime = 0;
        lastAtRestaurant = 0;
        keepTrack = [];
        currentSchedule = [];
        currentRoute = null;
        pointHopper = {};
        pause = true;
        speedFactor = 50;

        for (var i = 0; i < route.length - 1; i++) {
            var pt = geojsonPoints.features[route[i] - 1];
            if (pt) {
                pointHopper[pt.properties.id] = pt;
            }

        }

        var nothing = turf.featureCollection([]);

        map.addSource('route' + id, {
            type: 'geojson',
            data: nothing
        });

        map.addLayer({
            id: 'routearrows' + id,
            type: 'symbol',
            source: 'route' + id,
            layout: {
                'symbol-placement': 'line',
                'text-field': '▶',
                'text-size': [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    12, 24,
                    22, 60
                ],
                'symbol-spacing': [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    12, 30,
                    22, 160
                ],
                'text-keep-upright': false
            },
            paint: {
                'text-color': randomColor,
                'text-halo-color': 'hsl(55, 11%, 96%)',
                'text-halo-width': 3
            }
        }, 'waterway-label');

        map.addLayer({
            id: 'routeline-active' + id,
            type: 'line',
            source: 'route' + id,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': randomColor,
                'line-width': [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    12, 3,
                    22, 12
                ]
            }
        }, 'waterway-label');

        // Make a request to the Optimization API
        $.ajax({
            method: 'GET',
            url: assembleQueryURL(),
        }).done(function (data) {
            // Create a GeoJSON feature collection
            var routeGeoJSON = turf.featureCollection([turf.feature(data.trips[0].geometry)]);

            // If there is no route provided, reset
            if (!data.trips[0]) {
                routeGeoJSON = nothing;
            } else {
                // Update the `route` source by getting the route source
                // and setting the data equal to routeGeoJSON
                map.getSource('route' + id)
                    .setData(routeGeoJSON);
            }

            if (data.waypoints.length === 12) {
                window.alert('Maximum number of points reached. Read more at docs.mapbox.com/api/navigation/#optimization.');
            }
        });
    }
}

// Aux functions to send request to MAPBOX API
// Here you'll specify all the parameters necessary for requesting a response from the Optimization API
function assembleQueryURL() {

    // Store the location of the truck in a variable called coordinates
    var coordinates = [truckLocation];
    var distributions = [];
    keepTrack = [truckLocation];

    // Create an array of GeoJSON feature collections for each point
    var restJobs = objectToArray(pointHopper);

    // If there are any orders from this restaurant
    if (restJobs.length > 0) {

        // Check to see if the request was made after visiting the restaurant
        /* var needToPickUp = restJobs.filter(function (d, i) {
            return d.properties.orderTime > lastAtRestaurant;
        }).length > 0; */
        var needToPickUp = false;

        // If the request was made after picking up from the restaurant,
        // Add the restaurant as an additional stop
        if (needToPickUp) {
            var restaurantIndex = coordinates.length;
            // Add the restaurant as a coordinate
            coordinates.push(warehouseLocation);
            // push the restaurant itself into the array
            keepTrack.push(pointHopper.warehouse);
        }

        restJobs.forEach(function (d, i) {
            // Add dropoff to list
            keepTrack.push(d);
            coordinates.push(d.geometry.coordinates);
            // if order not yet picked up, add a reroute
            if (needToPickUp && d.properties.orderTime > lastAtRestaurant) {
                //distributions.push(restaurantIndex + ',' + (coordinates.length - 1));
            }
        });
    }

    // Set the profile to `driving`
    // Coordinates will include the current location of the truck,
    return 'https://api.mapbox.com/optimized-trips/v1/mapbox/driving/' + coordinates.join(';') + '?distributions=' + distributions.join(';') + '&overview=full&steps=true&geometries=geojson&source=first&access_token=' + mapboxgl.accessToken;
}

function objectToArray(obj) {
    var keys = Object.keys(obj);
    var routeGeoJSON = keys.map(function (key) {
        return obj[key];
    });
    return routeGeoJSON;
}

// Get random color
function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// add route tab depends of number of route and list of nodes route
function addRouteNodes(routeId, nodesList, randomColor) {
    var routeTab = '\
        <li class="nav-item" title="" style="background-color: '+ randomColor + '">\
            <a class="nav-link route-tab" data-toggle="tab" href="#route'+ routeId + '">Route ' + routeId + '</a>\
        </li>';

    $("#tabs-routes ul").append(routeTab);

    var routeDivContent = '<div id="route' + routeId + '" class="tab-pane fade"></div>';
    $("#routes-tab-content").append(routeDivContent);

    var routeTabContent = $("#table-nodesRoute").clone();
    routeTabContent.attr("id", "table-nodesRoute" + routeId);
    routeTabContent.removeClass("d-none");

    $("#route" + routeId).append(routeTabContent);

    for (j = 0; j < nodesList.length; j++) {
        var row = '\
                    <tr>\
                        <th scope="row">'+ (j + 1) + '</th>\
                        <td>Address ' + nodesList[j] + '</td>\
                        <td>0:07</td>\
                        <td>1.01 miles</td>\
                        <td>34</td>\
                    </tr>';

        $("#route" + routeId + " #table-nodesRoute" + routeId + " tbody").append(row);
    }
}

// tab panes
$("#tabs-sections a[href='#addresses'], #tabs-sections a[href='#goals'], #tabs-sections a[href='#results']").click(function (e) {
    var tabPaneSelected = $(this).text();

    if (tabPaneSelected == "ADDRESSES") {
        $('#nextTabButton').parent().show();
        $('#nextTabButton').text('Next');
    } else if (tabPaneSelected == "GOALS") {
        $('#nextTabButton').parent().show();
        $('#nextTabButton').text('Get Route!');
    } else {
        $('#nextTabButton').parent().hide();
    }

});

// Next button control to solve the problem
$('#nextTabButton').click(function (e) {
    var tabPaneSelected = getTabPaneSelected();

    if (tabPaneSelected == "ADDRESSES") {
        if (filledAdresses < 3) {
            alert('Error: need fill three or more rows..');
        } else {
            $("#tabs-sections a[href='#goals']").click();
        }
    } else if (tabPaneSelected == "GOALS") {
        if (filledAdresses < 3) {
            alert('Error: need fill three or more rows..');
            $("#tabs-sections a[href='#addresses']").click();
        } else {
            // Get parameters and send to server to execute algorithm
            var dataMatrix = getDataMatrix();
            var problemData = getProblemData();

            sendProblemData(dataMatrix, problemData);
            $("#tabs-sections a[href='#results']").click();
        }
    } else {

    }
});

function getTabPaneSelected() {
    var tabPaneSelected = $("#tabs-sections a.active").text();

    return tabPaneSelected;
}

function getDataMatrix() {
    var dataMatrix = [];
    var table = $("#table-parameters tbody tr");
    var countRows = 0;

    table.each(function (rowIndex, r) {
        if (countRows++ < filledAdresses) {
            var cols = [];

            $(this).find('td').each(function (colIndex, c) {
                var column = $(c);

                if (colIndex != 1 && colIndex != 2) {
                    if (column.children().length) {
                        cols.push(column.find('input').val());
                    }
                    else {
                        cols.push(column.text());
                    }
                }
            });
            if (cols.length) {
                dataMatrix.push(cols);
            }
        }
    });

    return dataMatrix;

}

function getProblemData() {
    var defaultServiceTime = $("#serviceTime").val();
    var vehiclesCapacity = $("#vehiclesCapacity").val();
    var availableVehicles = $("#availableVehicles").val();

    var problemData = {
        defaultServiceTime: defaultServiceTime,
        vehiclesCapacity: vehiclesCapacity,
        availableVehicles: availableVehicles
    }

    return problemData;
}

// save problem button BD

$("#save-problem").on('click', function (e) {
    $.ajax({
        type: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        url: 'save-problem',
        data: {

        },
        success: function (response) {
            $('.messagelist').empty();
            $("div#message-save").removeClass("alert-warning");
            $("div#message-save").removeClass("alert-success");
            if (response === 'already') {
                $('#message-save').append("<div class='message alert-warning'>Problem has been already saved!</div>");
            } else {
                $('#message-save').append("<div class='message alert-success'>Problem saved!</div>");
            }
        },
        error: function () {
            $('#message-save').empty();
            $('#message-save').append("<div class='message alert-danger'>Problem NOT saved!</div>");
        }
    });
})


// save problem button file

$("#export-problem").on('click', function (e) {
    $.ajax({
        type: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        url: 'export-problem',
        data: {

        },
        success: function (response) {

            $('#message-save').empty();
            $("div.messagelist").removeClass("alert-warning");
            $("div.messagelist").removeClass("alert-success");
            if (response === 'already') {
                $('.messagelist').append("<div class='message alert-warning'>Problem has been already exported!</div>");
            } else {
                $('.messagelist').append("<div class='message alert-success'>Problem exported!</div>");
            }
        },
        error: function () {
            $('.messagelist').empty();
            $('.messagelist').append("<div class='message alert-danger'>Problem NOT exported!</div>");
        }
    });
})

// end tabpanes

// Obtenemos el valor del parametro c_name
function getCookie(c_name) {
    if (document.cookie.length > 0) {
        c_start = document.cookie.indexOf(c_name + "=");
        if (c_start != -1) {
            c_start = c_start + c_name.length + 1;
            c_end = document.cookie.indexOf(";", c_start);
            if (c_end == -1) c_end = document.cookie.length;
            return unescape(document.cookie.substring(c_start, c_end));
        }
    }
    return "";
}

// END TABLE