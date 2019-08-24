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

$("#table-parameters tr").click(function () {
    $('.selected').removeClass('selected');
    $(this).addClass("selected");
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
    var markup = '<tr>\
        <td scope="row">'+ idLastRow + '</td>\
        <td><input type="text" id="row-'+ idLastRow + '-title" name="row-' + idLastRow + '-title" placeholder="Title (optional)" value=""></td>\
        <td><input type="text" id="row-'+ idLastRow + '-addresses" class="address-textbox" name="row-' + idLastRow + '-addresses" placeholder="Start address" value=""></td>\
        <td><input type="number" min="0" max="24" id="row-'+ idLastRow + '-srv" name="row-' + idLastRow + '-srv" placeholder="0" value="0"></td>\
        <td><input type="number" id="row-'+ idLastRow + '-bsize" name="row-' + idLastRow + '-bsize" value="0"></td>\
        <td><input type="number" id="row-'+ idLastRow + '-dsize" name="row-' + idLastRow + '-dsize" value="0"></td>\
        <td><input type="time" min="06:00" max="20:00" id="row-'+ idLastRow + '-fromtime" name="row-' + idLastRow + '-fromtime" placeholder="06:00" value="06:00"></td>\
        <td><input type="time" min="06:00" max="20:00" id="row-'+ idLastRow + '-untiltime" name="row-' + idLastRow + '-untiltime" placeholder="20:00" value="20:00"></td>';
    $("#table-parameters").append(markup);
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
    // https://github.com/mapbox/mapbox-sdk-js/blob/master/docs/services.md#getmatrix

    // Vemos los puntos elegidos por el usuario en consola
    console.log(geojsonPoints);

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
            console.log(matrix);

            // Una vez tenemos la matriz de distancias, la enviamos al servidor para crear el archivo de entrada al algoritmo
            // (enviamos csrf token de seguridad obtenida de la cookie)
            $.ajax({
                type: "POST",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                url: 'nodes-data',
                data: {
                    'distance_matrix': JSON.stringify(matrix.distances),
                    'matrix_data': JSON.stringify(dataMatrix),
                    'problem_data': JSON.stringify(problemData)
                },
                success: function (response, data) {
                    console.log('Enviado correctamente: ' + response);
                }
            });
        });
}

// tab panes

$('#nextTabButton').click(function (e) {
    var tabPaneSelected = getTabPaneSelected();

    if (tabPaneSelected == "ADDRESSES") {
        $("#tabs-sections a[href='#goals']").click();
    } else if (tabPaneSelected == "GOALS") {
        // CHeck possible problems
        if (filledAdresses < 2) {
            console.error('Error: need fill three or more rows..');
        } else {
            var dataMatrix = getDataMatrix();
            var problemData = getProblemData();

            //console.log(dataMatrix);
            //console.log(problemData);
            // Obtener parámetros y creamos el problema
            sendProblemData(dataMatrix, problemData);
        }
    } else {
        $('#nextTabButton').text('Get Route');

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