const express = require("express");
const router = express.Router();
const scrap = require("scrap");
const path = require("path");
const urlToImage = require('url-to-image');
const jimp = require('jimp');
const mongoDB = require("mongodb");

let dbSitesClient = null;
let dbCategoriesClient = {};

router.get("/list", (req, res) => {
  let query = {};
  if(req.query.category)
    query = {category: mongoDB.ObjectID(req.query.category)};
  dbSitesClient.find(query).toArray((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    return res.status(200).json({list: data});
  });
});

router.get("/categories", (req, res) => {
  getCategories()
  .then(categories => res.status(200).json({categories}))
  .catch(err => res.status(500).json({ error: err.message }));
});

router.post("/create", async (req, res) => {
  // Recojo los params de la petición (cuerpo)
  const urlWeb = req.body.url;
  const categoryWeb = req.body.category || "Todas";
  getCategories({name: categoryWeb})
  .then(categories => {
    // If not empty resolve with existing id
    // If empty insert the new category and resolve with generated id
    if(categories.length)
      return Promise.resolve({insertedId: categories[0]._id});
    else
      return dbCategoriesClient.insertOne({name: categoryWeb});
  })
  .then(async (category) => {
    const scrappedInfo = await scrapURL(urlWeb);
    return dbSitesClient.insertOne({
      url: urlWeb,
      category: category.insertedId,
      ...scrappedInfo
    })
  })
  .then(createdSite => {
    // Server response containing the generated document
    res.status(201).json(createdSite.ops);
  })
  .catch(err => {
    console.error("Error al insertar el site");
    return res.status(500).send();
  });

});

//
// Helper functions
//
async function scrapURL(urlWeb){
  return new Promise((resolveScrap, rejectScrap) => {
    scrap(urlWeb, async (err, $, code, html) => {
      if (err) {
        return res.status(500).send();
      }
  
      // Scrapping para obtener Título y Descripción
      const titleScrap = $("title").text();
      const metaDescription = $("meta[name=description]").attr("content");
  
      // Crear screenshot
      const imageName = `image-${new Date().getTime()}.png`;
      const pathToSave = path.resolve(__basepath, "public", "images", imageName);
      const pathToSaveOptimized = path.resolve(__basepath, "public", "images", "optimized", imageName);
      const imageUrl = `images/optimized/${imageName}`;
      
      // Scrap and optimize image
      await urlToImage(urlWeb, pathToSave).catch(err => res.status(500).send());
      const rawImage = await jimp.read(pathToSave);
      await rawImage.resize(450, jimp.AUTO).crop(0, 0, 450, 300).quality(80).writeAsync(pathToSaveOptimized);
  
      // Return scrapped values
      resolveScrap({
        title: titleScrap,
        description: metaDescription,
        image: imageUrl
      });
    });
  });
}

function getCategories(query){
  if(!query)
    query = {};
  return new Promise((resolve, reject) => {
    dbCategoriesClient.find(query).toArray((err, data) => {
      if (err)
        reject(err);
      else
        resolve(data);
      });
    }
  );
}

module.exports = {
  router,
  setMongoClient: client => {
    dbSitesClient = client.collection("sites");
    dbCategoriesClient = client.collection("categories");
  }
};
