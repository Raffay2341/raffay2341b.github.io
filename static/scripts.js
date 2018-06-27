// Google Map
let map;

// Markers for map
let markers = [];

// Info window
let info = new google.maps.InfoWindow();


// Execute when the DOM is fully loaded
$(document).ready(function() {

    // Styles for map
    // https://developers.google.com/maps/documentation/javascript/styling
    let styles = [

        // Hide Google's labels
        {
            featureType: "all",
            elementType: "labels",
            stylers: [
                {visibility: "off"}
            ]
        },

        // Hide roads
        {
            featureType: "road",
            elementType: "geometry",
            stylers: [
                {visibility: "off"}
            ]
        }

    ];

    // Options for map
    // https://developers.google.com/maps/documentation/javascript/reference#MapOptions
    let options = {
        center: {lat: 37.4236, lng: -122.1619}, // Stanford, California
        disableDefaultUI: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        maxZoom: 14,
        panControl: true,
        styles: styles,
        zoom: 13,
        zoomControl: true
    };

    // Get DOM node in which map will be instantiated
    let canvas = $("#map-canvas").get(0);

    // Instantiate map
    map = new google.maps.Map(canvas, options);

    // Configure UI once Google Map is idle (i.e., loaded)
    google.maps.event.addListenerOnce(map, "idle", configure);

});


// Add marker for place to map
function addMarker(place)
{
    // instantiates a marker
    let myLatLng = {lat: place.latitude, lng: place.longitude};
    let marker = new google.maps.Marker({
        position: myLatLng,
        map: map,
        title: place.place_name + ', ' + place.admin_name1,
        label: {
            text: place.place_name + ', ' + place.admin_name1,
            color: "black",
            fontWeight: "bold",
            fontSize: "12px",
            align: 'right'
        },

        // Custom image for the marker
        icon: {
            url: 'http://maps.google.com/mapfiles/ms/micons/red-dot.png',
            labelOrigin: new google.maps.Point(11,40)
        }
    });

    // Makes a postal code object named parameters with geo as the only key so /articles can fetch that postal code through request.args.get("geo")
    geo = place.postal_code;
    var parameters = {
        geo
    };

    // adds event listener to the marker that listens for clicks and opens info window
    marker.addListener('click', function(){

        // generates a GET request to route articles, which then fetches articles via postal code of place
        $.getJSON("/articles", parameters, function(data) {

            // generates a window complete with articles
            showInfo(marker, data);
        });
    });

    // remembers the markers in an array by appending to the markers array
    markers.push(marker)
}


// Configure application
function configure()
{
    // Update UI after map has been dragged
    google.maps.event.addListener(map, "dragend", function() {

        // If info window isn't open
        // http://stackoverflow.com/a/12410385
        if (!info.getMap || !info.getMap())
        {
            update();
        }
    });

    // Update UI after zoom level changes
    google.maps.event.addListener(map, "zoom_changed", function() {
        update();
    });

    // Configure typeahead
    $("#q").typeahead({
        highlight: false,
        minLength: 1
    },
    {
        display: function(suggestion) { return null; },
        limit: 10,
        source: search,
        templates: {
            suggestion: Handlebars.compile(
                "<div>" +
                "{{place_name}}, {{admin_name1}}, {{postal_code}}" +
                "</div>"
            )
        }
    });

    // Re-center map after place is selected from drop-down
    $("#q").on("typeahead:selected", function(eventObject, suggestion, name) {

        // Set map's center
        map.setCenter({lat: parseFloat(suggestion.latitude), lng: parseFloat(suggestion.longitude)});

        // Update UI
        update();
    });

    // Hide info window when text box has focus // I think it closes any info window open when the text box is clicked i.e. an option from the dropdown menu is selected
    $("#q").focus(function(eventData) {
        info.close();
    });

    // Re-enable ctrl- and right-clicking (and thus Inspect Element) on Google Map
    // https://chrome.google.com/webstore/detail/allow-right-click/hompjdfbfmmmgflfjdlnkohcplmboaeo?hl=en
    document.addEventListener("contextmenu", function(event) {
        event.returnValue = true;
        event.stopPropagation && event.stopPropagation();
        event.cancelBubble && event.cancelBubble();
    }, true);

    // Update UI
    update();

    // Give focus to text box // focuses to text box i.e. gets cursor there automatically so user doesn't have to click on the text box.
    $("#q").focus();


}


// Remove markers from map
function removeMarkers()
{

    // Deletes all markers on map w.r.t dragging the map, but keeps the markers in view (although underneath the hood it deletes them but then adds them again, per the dragend event that calls the update function)
    for (var marker of markers)
    {
        marker.setMap(null);
    }

    // removes references to old markers
    markers = [];

}


// Search database for typeahead's suggestions
function search(query, syncResults, asyncResults)
{
    // Get places matching query (asynchronously)
    let parameters = {
        q: query
    };
    $.getJSON("/search", parameters, function(data, textStatus, jqXHR) {

        // Call typeahead's callback with search results (i.e., places)
        asyncResults(data);
    });
}


// Show info window at marker with content
function showInfo(marker, content)
{
    // Start div
    let div = "<div id='info'>";
    if (typeof(content) == "undefined")
    {
        // http://www.ajaxload.info/
        div += "<img alt='loading' src='/static/ajax-loader.gif'/>";
    }
    else
    {
        // creates a list
        div += "<ul>";
        // iterates over each link and title collectively in the returned JSON object containing links and titles to articles, and then appends to the info windows content while creating an unordered list
        var p;
        for (p = 0; p < content.length; p++)
        {
            div += "<li>";
            div += "<a href=" + content[p]["link"] + "title=" + content[p]["title"] + ">" + content[p]["title"] + "</a>";
            div += "</li>";
        }

        // ends list
        div += "</ul>";
    }

    // End div
    div += "</div>";

    // Set info window's content
    info.setContent(div);

    // Open info window (if not already open)
    info.open(map, marker);
}


// Update UI's markers
function update()
{
    // Get map's bounds
    let bounds = map.getBounds();
    let ne = bounds.getNorthEast();
    let sw = bounds.getSouthWest();

    // Get places within bounds (asynchronously)
    let parameters = {
        ne: `${ne.lat()},${ne.lng()}`,
        q: $("#q").val(),
        sw: `${sw.lat()},${sw.lng()}`
    };
    $.getJSON("/update", parameters, function(data, textStatus, jqXHR) {

       // Remove old markers from map
       removeMarkers();

       // Add new markers to map
       for (let i = 0; i < data.length; i++)
       {
           addMarker(data[i]);
       }
    });
}
