try {
  require('./lib/index.js');
  console.log("SUCCESS: require('./lib/index.js') finished without throwing.");
} catch (e) {
  console.log("CRASH ON REQUIRE:");
  console.log(e.stack);
}
