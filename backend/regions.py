"""UK region tree for extraction filters.

Companies House `advanced-search` accepts a `location` string that is matched
against the registered office address. We surface a curated tree of nations,
English regions and counties to build the sidebar picker.
"""

UK_REGIONS = [
    {
        "id": "england",
        "name": "England",
        "children": [
            {"id": "london", "name": "Greater London", "location": "London"},
            {"id": "south-east", "name": "South East", "children": [
                {"id": "kent", "name": "Kent", "location": "Kent"},
                {"id": "surrey", "name": "Surrey", "location": "Surrey"},
                {"id": "sussex", "name": "West Sussex", "location": "West Sussex"},
                {"id": "hampshire", "name": "Hampshire", "location": "Hampshire"},
                {"id": "oxfordshire", "name": "Oxfordshire", "location": "Oxfordshire"},
                {"id": "berkshire", "name": "Berkshire", "location": "Berkshire"},
                {"id": "buckinghamshire", "name": "Buckinghamshire", "location": "Buckinghamshire"},
            ]},
            {"id": "south-west", "name": "South West", "children": [
                {"id": "devon", "name": "Devon", "location": "Devon"},
                {"id": "cornwall", "name": "Cornwall", "location": "Cornwall"},
                {"id": "somerset", "name": "Somerset", "location": "Somerset"},
                {"id": "dorset", "name": "Dorset", "location": "Dorset"},
                {"id": "bristol", "name": "Bristol", "location": "Bristol"},
                {"id": "gloucestershire", "name": "Gloucestershire", "location": "Gloucestershire"},
            ]},
            {"id": "east", "name": "East of England", "children": [
                {"id": "essex", "name": "Essex", "location": "Essex"},
                {"id": "norfolk", "name": "Norfolk", "location": "Norfolk"},
                {"id": "suffolk", "name": "Suffolk", "location": "Suffolk"},
                {"id": "cambridgeshire", "name": "Cambridgeshire", "location": "Cambridgeshire"},
                {"id": "hertfordshire", "name": "Hertfordshire", "location": "Hertfordshire"},
            ]},
            {"id": "west-midlands", "name": "West Midlands", "children": [
                {"id": "birmingham", "name": "Birmingham", "location": "Birmingham"},
                {"id": "warwickshire", "name": "Warwickshire", "location": "Warwickshire"},
                {"id": "worcestershire", "name": "Worcestershire", "location": "Worcestershire"},
                {"id": "staffordshire", "name": "Staffordshire", "location": "Staffordshire"},
            ]},
            {"id": "east-midlands", "name": "East Midlands", "children": [
                {"id": "leicestershire", "name": "Leicestershire", "location": "Leicestershire"},
                {"id": "nottinghamshire", "name": "Nottinghamshire", "location": "Nottinghamshire"},
                {"id": "derbyshire", "name": "Derbyshire", "location": "Derbyshire"},
                {"id": "lincolnshire", "name": "Lincolnshire", "location": "Lincolnshire"},
            ]},
            {"id": "yorkshire", "name": "Yorkshire & Humber", "children": [
                {"id": "west-yorkshire", "name": "West Yorkshire", "location": "West Yorkshire"},
                {"id": "south-yorkshire", "name": "South Yorkshire", "location": "South Yorkshire"},
                {"id": "north-yorkshire", "name": "North Yorkshire", "location": "North Yorkshire"},
                {"id": "east-yorkshire", "name": "East Yorkshire", "location": "East Yorkshire"},
            ]},
            {"id": "north-west", "name": "North West", "children": [
                {"id": "manchester", "name": "Greater Manchester", "location": "Manchester"},
                {"id": "merseyside", "name": "Merseyside", "location": "Liverpool"},
                {"id": "lancashire", "name": "Lancashire", "location": "Lancashire"},
                {"id": "cheshire", "name": "Cheshire", "location": "Cheshire"},
            ]},
            {"id": "north-east", "name": "North East", "children": [
                {"id": "newcastle", "name": "Tyne and Wear", "location": "Newcastle upon Tyne"},
                {"id": "durham", "name": "County Durham", "location": "Durham"},
                {"id": "northumberland", "name": "Northumberland", "location": "Northumberland"},
            ]},
        ],
    },
    {
        "id": "scotland",
        "name": "Scotland",
        "children": [
            {"id": "edinburgh", "name": "Edinburgh", "location": "Edinburgh"},
            {"id": "glasgow", "name": "Glasgow", "location": "Glasgow"},
            {"id": "aberdeen", "name": "Aberdeen", "location": "Aberdeen"},
            {"id": "dundee", "name": "Dundee", "location": "Dundee"},
            {"id": "highlands", "name": "Highlands", "location": "Inverness"},
        ],
    },
    {
        "id": "wales",
        "name": "Wales",
        "children": [
            {"id": "cardiff", "name": "Cardiff", "location": "Cardiff"},
            {"id": "swansea", "name": "Swansea", "location": "Swansea"},
            {"id": "newport", "name": "Newport", "location": "Newport"},
            {"id": "wrexham", "name": "Wrexham", "location": "Wrexham"},
        ],
    },
    {
        "id": "northern-ireland",
        "name": "Northern Ireland",
        "children": [
            {"id": "belfast", "name": "Belfast", "location": "Belfast"},
            {"id": "derry", "name": "Derry", "location": "Londonderry"},
            {"id": "antrim", "name": "County Antrim", "location": "Antrim"},
        ],
    },
]


def flatten_regions():
    out = []
    def walk(node, path):
        cur = path + [node["name"]]
        if "location" in node:
            out.append({"id": node["id"], "path": " › ".join(cur), "location": node["location"]})
        for c in node.get("children", []):
            walk(c, cur)
    for r in UK_REGIONS:
        walk(r, [])
    return out


def find_region(region_id: str):
    for r in flatten_regions():
        if r["id"] == region_id:
            return r
    return None
