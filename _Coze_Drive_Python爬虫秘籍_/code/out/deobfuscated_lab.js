var secretSalt = "SPIDER_LAB";
function calcSignature(a, b) {
  var h = 5381;
  var s = a + "|" + b + "|" + secretSalt;
  for (var i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}
