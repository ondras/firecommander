#!/bin/sh
APPDIR=firecommander@ondras.zarovi.cz
VERSION=`cat $APPDIR/install.rdf | grep em:version | sed "s/[^0-9.b]//g"`
MIN=`cat $APPDIR/install.rdf | grep em:minVersion | head -1 | sed "s/[^0-9.\*]//g"`
MAX=`cat $APPDIR/install.rdf | grep em:maxVersion | head -1 | sed "s/[^0-9.\*]//g"`

### xpi
mkdir xpi
cp -r $APPDIR/* xpi
cd xpi
rm application.ini
zip -r ../firecommander-${VERSION}.xpi *
cd ..
rm -r xpi

### xulrunner variant
mkdir xr
cp -r $APPDIR/* xr
cd xr
rm install.rdf

# application.ini
TS=`date +%s`
sed -e "s,__VERSION__,$VERSION," \
	-e "s,__TS__,$TS," \
	-e "s,__MIN__,$MIN," \
	-e "s,__MAX__,$MAX," \
	application.ini > application.ini.new
mv application.ini.new application.ini

# preferences
cd defaults/preferences
echo 'pref("toolkit.defaultChromeURI", "chrome://firecommander/content/firecommander.xul");' >> prefs.js
echo 'pref("browser.preferences.instantApply", false);' >> prefs.js
echo 'pref("javascript.options.showInConsole", true);' >> prefs.js
echo 'pref("browser.dom.window.dump.enabled", true);' >> prefs.js
cd ../..

zip -r ../firecommander-${VERSION}-xr.zip *
cd ..
#rm -r xr
