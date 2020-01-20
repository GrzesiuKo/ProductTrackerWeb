var express = require("express");
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;

var CONTACTS_COLLECTION = "contacts";

var config = require('./config');

var app = express();
app.use(bodyParser.json());

// Create link to Angular build directory
var distDir = __dirname + "/dist/";
app.use(express.static(distDir));

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/test", function (err, client) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = client.db();
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

// CONTACTS API ROUTES BELOW

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}

/*  "/api/contacts"
 *    GET: finds all contacts
 *    POST: creates a new contact
 */

app.get("/api/contacts", function(req, res) {
  db.collection(CONTACTS_COLLECTION).find({}).toArray(function(err, docs) {
    if (err) {
      handleError(res, err.message, "Failed to get contacts.");
    } else {
      res.status(200).json(docs);
    }
  });
});

function httpGet(theUrl)
{
  var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
  xmlHttp.send( null );
  return xmlHttp.responseText;
}

function obtain_description(barcode) {
  var link = config.barcode_api;
  var url = link.concat(barcode)
  var response = httpGet(url)
  console.log("Response: "+response)
  var res = JSON.parse(response)
  console.log("Response object JSON: "+res)
  console.log("Response NAME: "+res[0].name)
  return res[0].name;
}

app.post("/api/contacts", function(req, res) {
  var newContact = req.body;
  newContact.createDate = new Date();

  if (!req.body.barcode) {
    handleError(res, "Invalid user input", "Must provide a name. --> "+req.toString(), 400);
  } else {
    console.log('Body: '+ JSON.stringify(req.body))
    let query = {"barcode": {$eq: req.body.barcode}};
    let projection = {};
    let document = db.collection(CONTACTS_COLLECTION).findOne(query, projection);

    document.then(function(value) {
      console.log(value);

      if (value === null){
        console.log("##########Nothing found")

        newContact.description = obtain_description(newContact.barcode)

        if (newContact.description === undefined){
          newContact.description = "Product not found in database"
        }

        console.log("Description: "+newContact.description)

        db.collection(CONTACTS_COLLECTION).insertOne(newContact, function(err, doc) {
          if (err) {
            handleError(res, err.message, "Failed to create new contact.");
          } else {
            res.status(201).json(doc.ops[0]);
          }
        });
      }else {
        let count = parseInt(value.count);
        count++;
        db.collection(CONTACTS_COLLECTION).updateOne({_id: ObjectID(value._id)},{$set: {"count": count}} , function(err, doc) {
          if (err) {
            handleError(res, err.message, "Failed to update contact");
          } else {
            value._id = req.params.id;
            res.status(200).json(value);
          }
        });
      }

    });

  }
});

/*  "/api/contacts/:id"
 *    GET: find contact by id
 *    PUT: update contact by id
 *    DELETE: deletes contact by id
 */

app.get("/api/contacts/:id", function(req, res) {
  db.collection(CONTACTS_COLLECTION).findOne({ _id: new ObjectID(req.params.id) }, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to get contact");
    } else {
      res.status(200).json(doc);
    }
  });
});

app.put("/api/contacts/:id", function(req, res) {
  var updateDoc = req.body;
  delete updateDoc._id;
  console.log(JSON.stringify(updateDoc))

  db.collection(CONTACTS_COLLECTION).updateOne(
    {_id: new ObjectID(req.params.id)},
    {$set: {"count": updateDoc.count, "description": updateDoc.description}}, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to update contact");
    } else {
      updateDoc._id = req.params.id;
      res.status(200).json(updateDoc);
    }
  });
});

app.delete("/api/contacts/:id", function(req, res) {
  db.collection(CONTACTS_COLLECTION).deleteOne({_id: new ObjectID(req.params.id)}, function(err, result) {
    if (err) {
      handleError(res, err.message, "Failed to delete contact");
    } else {
      res.status(200).json(req.params.id);
    }
  });
});

app.delete("/api/contacts/delete/:barcode", function(req, res) {
  let query = {"barcode": {$eq: req.params.barcode}};
  let projection = {};
  let document = db.collection(CONTACTS_COLLECTION).findOne(query, projection);

  document.then(function(value) {
    console.log(value);

    if(value != null){

      let count = parseInt(value.count);

      if (count <= 1){
        db.collection(CONTACTS_COLLECTION).deleteOne({_id: ObjectID(value._id)}, function(err, result) {
          if (err) {
            handleError(res, err.message, "Failed to delete contact");
          } else {
            res.status(200).json(req.params.id);
          }
        });
      }else{
        count--;
        db.collection(CONTACTS_COLLECTION).updateOne({_id: ObjectID(value._id)},{$set: {"count": count}} , function(err, doc) {
          if (err) {
            handleError(res, err.message, "Failed to update contact");
          } else {
            value._id = req.params.id;
            res.status(200).json(value);
          }
        });
      }
    }

  });
});
