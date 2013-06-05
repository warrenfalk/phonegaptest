import os
import re
from os import path
import subprocess
from pprint import pprint

svgdir = "../www/img/svg"
pngdir = "../www/img/gen"
inkscape = 'c:\Program Files (x86)\InkScape\inkscape.exe'

# Render PNG from SVG
# make dir if necessary
os.makedirs(pngdir)
for filename in os.listdir(svgdir):
	outname = re.sub('\.svg$', '.png', filename)
	filepath = path.abspath(path.join(svgdir, filename))
	outpath = path.abspath(path.join(pngdir, outname))
	if not path.exists(outpath) or path.getctime(filepath) > path.getctime(outpath):
		cmd = [inkscape, '--file=' + filepath, '--export-png=' + outpath, '--export-area-page', '--export-background-opacity=0']
		print(" GENPNG   " + filename)
		subprocess.call(cmd)
