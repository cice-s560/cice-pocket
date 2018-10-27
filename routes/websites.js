const express = require("express");
const router = express.Router();
const scrap = require("scrap");
const path = require("path");
const urlToImage = require('url-to-image');
const jimp = require('jimp');

let dbClient = null;

router.get("/list", (req, res) => {
  dbClient.find({}).toArray((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const category = req.query.category;
    if(!category || category === "Todas")
      return res.status(200).json({ list: data });
    return res.status(200).json({ 
      list: data.filter(web => web.category === category)
    });
  });
});

router.get("/categories", (req, res) => {
  dbClient.find({}).toArray((err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    let categories = ["Todas"];
    data.forEach(web => categories.push(web.category));

    return res.status(200).json({categories});
  });
});

router.post("/create", async (req, res) => {
  // Recojo los params de la petición (cuerpo)
  const urlWeb = req.body.url;
  const categoryWeb = req.body.category || "Todas";

  const urlScrapped = scrap(urlWeb, async (err, $, code, html) => {
    if (err) {
      return res.status(500).send();
    }

    // Scrapping para obtener Título y Descripción
    // Cogemos etiqueta title
    const titleScrap = $("title").html();
    // Buscamos entre los metas para encontrar el "Description"
    const $metas = $("meta");
    const metaDescription = Object.keys($metas).filter(item => $metas[item].attribs && $metas[item].attribs.name && $metas[item].attribs.name.toLowerCase() === "description");
    const descriptionScrap = $metas[metaDescription].attribs.content;

    // Crear screenshot
    const imageName = `image-${new Date().getTime()}.png`;
    const pathToSave = path.resolve(__basepath, "public", "images", imageName);
    const pathToSaveOptimized = path.resolve(__basepath, "public", "images", "optimized", imageName);
    const imageUrl = `images/optimized/${imageName}`;

    await urlToImage(urlWeb, pathToSave).catch(err => res.status(500).send());

    const rawImage = await jimp.read(pathToSave);

    await rawImage.resize(450, jimp.AUTO).crop(0, 0, 450, 300).quality(80).writeAsync(pathToSaveOptimized);

    // Creamos el documento
    const insertion = await dbClient
      .insertOne({
        url: urlWeb,
        title: titleScrap,
        description: descriptionScrap,
        image: imageUrl,
        category: categoryWeb
      })
      .catch(err => res.status(500).json({ error: err.message }));

    return res.status(201).json({
      url: urlWeb,
      title: titleScrap,
      description: descriptionScrap,
      image: imageUrl
    });
  });


});

module.exports = {
  router,
  setMongoClient: client => (dbClient = client.collection("sites"))
};
