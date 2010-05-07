#!/bin/sh

cd firecommander@ondras.zarovi.cz
VERSION=`cat install.rdf | grep em:version | sed "s/[^0-9.]//g"`
zip -r ../firecommander-${VERSION}.xpi * -x *.svn*
cd ..
