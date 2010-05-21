#!/bin/sh
APPDIR=firecommander@ondras.zarovi.cz
VERSION=`cat $APPDIR/install.rdf | grep em:version | sed "s/[^0-9.]//g"`
MIN=`cat $APPDIR/install.rdf | grep em:minVersion | sed "s/[^0-9.\*]//g"`
MAX=`cat $APPDIR/install.rdf | grep em:maxVersion | sed "s/[^0-9.\*]//g"`

### xpi
mkdir xpi
cp -r $APPDIR/* xpi
find xpi -name .svn -print0 | xargs -0 rm -rf
cd xpi
rm application.ini
zip -r ../firecommander-${VERSION}.xpi *
cd ..
rm -r xpi

### xulrunner variant
mkdir xr
cp -r $APPDIR/* xr
find xr -name .svn -print0 | xargs -0 rm -rf
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

# chrome manifest
mv chrome.manifest chrome/
cd chrome
sed -e "s,chrome/,," \
	-e "s,^overlay.*,," \
	chrome.manifest > chrome.manifest.new
mv chrome.manifest.new chrome.manifest
cd ..


# preferences
cd defaults/preferences
echo 'pref("toolkit.defaultChromeURI", "chrome://firecommaner/content/firecommander.xul");' >> prefs.js
cd ../..

zip -r ../firecommander-${VERSION}-xr.zip *
cd ..
rm -r xr
