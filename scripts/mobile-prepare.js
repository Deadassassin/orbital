/**
 * Mobile prepare script: copies renderer assets (css, js, pages) to src/mobile/
 * Run before `npx cap sync` so Capacitor picks up the right files.
 *
 * Usage: node scripts/mobile-prepare.js
 */
var fs = require('fs');
var path = require('path');

var srcDir = path.join(__dirname, '..', 'src', 'renderer');
var dstDir = path.join(__dirname, '..', 'src', 'mobile');
var dirs = ['css', 'js', 'pages'];

dirs.forEach(function(dir) {
  var src = path.join(srcDir, dir);
  var dst = path.join(dstDir, dir);
  if (!fs.existsSync(src)) {
    console.error('Source directory not found:', src);
    process.exit(1);
  }
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });

  var entries = fs.readdirSync(src);
  entries.forEach(function(entry) {
    var srcFile = path.join(src, entry);
    var dstFile = path.join(dst, entry);
    var stat = fs.statSync(srcFile);
    if (stat.isFile()) {
      fs.copyFileSync(srcFile, dstFile);
      console.log('  Copied:', path.relative(dstDir, dstFile));
    }
  });
});

console.log('Mobile prepare complete. Files copied to src/mobile/');
