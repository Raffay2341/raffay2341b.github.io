import os
import re
from flask import Flask, jsonify, render_template, request
import json

from cs50 import SQL
from helpers import lookup

# Configure application
app = Flask(__name__)
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False # returns a json object that is minified i.e. the whitespaces are gone instead to match the staff solution

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///mashup.db")


# Ensure responses aren't cached
@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response


@app.route("/")
def index():
    """Render map"""
    if not os.environ.get("API_KEY"):
        raise RuntimeError("API_KEY not set")
    return render_template("index.html", key=os.environ.get("API_KEY"))


@app.route("/articles")
def articles():
    """Look up articles for geo"""

    # error checking for geo
    if not request.args.get("geo"):
        raise RuntimeError("missing geo")

    # extracts geo i.e. postal code for a certain location from the GET request
    geo_ = request.args.get("geo")

    # fetches a dictionary of articles thanks to lookup
    dictarticles = lookup(geo_)

    # returns that dict as a JSON to the browser
    return jsonify(dictarticles)


@app.route("/search")
def search():
    """Search for places that match query"""

    # error checking
    if not request.args.get("q"):
        raise RuntimeError("missing query")

    # fetches city, state, or postal code entered, separate variable for city state postal code
    qz = request.args.get("q") + "%"
    q = request.args.get("q")

    # fetches rows from database where city, state, or postal code is equal to the query entered
    rows = db.execute("SELECT * FROM places WHERE place_name = :q OR admin_name1 = :q OR postal_code = :qz", q=q, qz=qz)

    # returns rows as JSON
    return jsonify(rows)


@app.route("/update")
def update():
    """Find up to 10 places within view"""

    # Ensure parameters are present #request.args.get is fetching the two corners co-ordinates. the url is like ne=whateverco-ordinates and sw=blah blah, check update implemenation in pset doc for more info
    if not request.args.get("sw"):
        raise RuntimeError("missing sw")
    if not request.args.get("ne"):
        raise RuntimeError("missing ne")

    # Ensure parameters are in lat,lng format
    if not re.search("^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$", request.args.get("sw")):
        raise RuntimeError("invalid sw")
    if not re.search("^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$", request.args.get("ne")):
        raise RuntimeError("invalid ne")

    # Explode southwest corner into two variables # split here is returning an array of two items by splitting the comma in between lat and lng, first is lat, second is lng, and sw_lat and sw_lng is getting assigned respectively
    sw_lat, sw_lng = map(float, request.args.get("sw").split(","))

    # Explode northeast corner into two variables
    ne_lat, ne_lng = map(float, request.args.get("ne").split(","))

    # Find 10 cities within view, pseudorandomly chosen if more within view
    if sw_lng <= ne_lng:

        # Doesn't cross the antimeridian
        rows = db.execute("""SELECT * FROM places
                          WHERE :sw_lat <= latitude AND latitude <= :ne_lat AND (:sw_lng <= longitude AND longitude <= :ne_lng)
                          GROUP BY country_code, place_name, admin_code1
                          ORDER BY RANDOM()
                          LIMIT 10""",
                          sw_lat=sw_lat, ne_lat=ne_lat, sw_lng=sw_lng, ne_lng=ne_lng)

    else:

        # Crosses the antimeridian
        rows = db.execute("""SELECT * FROM places
                          WHERE :sw_lat <= latitude AND latitude <= :ne_lat AND (:sw_lng <= longitude OR longitude <= :ne_lng)
                          GROUP BY country_code, place_name, admin_code1
                          ORDER BY RANDOM()
                          LIMIT 10""",
                          sw_lat=sw_lat, ne_lat=ne_lat, sw_lng=sw_lng, ne_lng=ne_lng)

    # Output places as JSON
    return jsonify(rows)
