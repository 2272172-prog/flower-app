db.collection("flowers").get().then(snapshot => {
  console.log("Документов:", snapshot.size);
  snapshot.forEach(doc => console.log(doc.data()));
});
