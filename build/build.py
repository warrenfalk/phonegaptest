import os
import re
from os import path
import subprocess
from pprint import pprint
import shutil

svgdir = "../www/img/svg"
pngdir = "../www/img/gen"
png2dir = "../www/img/gen/dbl"
icondir = "../www/icons"
inkscape = 'c:\Program Files (x86)\InkScape\inkscape.exe'

def outdated(source, target):
	return not path.exists(target) or path.getmtime(source) > path.getmtime(target)

def genPngIcons(platform, sizes):
	for size in sizes:
		filename = '%s.svg' % platform
		outname = 'inpos-%s-%d.png' % (platform, size)
		filepath = path.abspath(path.join(icondir, filename))
		outpath = path.abspath(path.join(icondir, platform, outname))
		if outdated(filepath, outpath):
			cmd = [inkscape, '--file=' + filepath, '--export-png=' + outpath, '--export-area-page', '--export-height=%d' % size, '--export-use-hints', '--export-background-opacity=0']
			print(" GENPNG   %s (%dx%d)" % (filename, size, size))
			subprocess.call(cmd)

def genPngs():
	# make dir if necessary
	if not path.exists(pngdir):
		os.makedirs(pngdir)
	if not path.exists(png2dir):
		os.makedirs(png2dir)
	names = set()
	for filename in os.listdir(svgdir):
		name = re.sub('\.svg$', '', filename)
		names.add(name)
		outname = name + '.png'
		filepath = path.abspath(path.join(svgdir, filename))
		outpath = path.abspath(path.join(pngdir, outname))
		if outdated(filepath, outpath):
			cmd = [inkscape, '--file=' + filepath, '--export-png=' + outpath, '--export-area-page', '--export-background-opacity=0']
			print(" GENPNG   " + filename)
			subprocess.call(cmd)
		outpath = path.abspath(path.join(png2dir, outname));
		if (outdated(filepath, outpath)):
			cmd = [inkscape, '--file=' + filepath, '--export-png=' + outpath, '--export-area-page', '--export-background-opacity=0', '--export-dpi=180']
			print(" GENPNG2  " + filename)
			subprocess.call(cmd)
	for filename in os.listdir(pngdir):
		filepath = path.join(pngdir, filename)
		if not path.isdir(filepath):
			name = re.sub('\.png$', '', filename)
			if not name in names:
				print(" DELETE   " + filename)
				os.remove(filepath)
	for filename in os.listdir(png2dir):
		filepath = path.join(png2dir, filename)
		if not path.isdir(filepath):
			name = re.sub('\.png$', '', filename)
			if not name in names:
				print(" DELETE   " + filename)
				os.remove(filepath)


def copy(source, target):
	if outdated(source, target):
		print(" COPY     %s" % path.basename(source))
		shutil.copy2(source, target)


def copyAndroidIcons():
	# if we are in an android project, copy the icons up to the project from the assets folder
	if path.exists('../../res'):
		copy(path.join(icondir, 'android', 'inpos-android-36.png'), '../../res/drawable-ldpi/icon.png')
		copy(path.join(icondir, 'android', 'inpos-android-48.png'), '../../res/drawable-mdpi/icon.png')
		copy(path.join(icondir, 'android', 'inpos-android-72.png'), '../../res/drawable-hdpi/icon.png')
		copy(path.join(icondir, 'android', 'inpos-android-96.png'), '../../res/drawable-xhdpi/icon.png')
		copy(path.join(icondir, 'android', 'inpos-android-96.png'), '../../res/drawable/icon.png')


genPngs()
genPngIcons('android', [36, 48, 72, 96, 144, 512])
genPngIcons('ios', [57, 72, 114, 144, 512, 1024])
copyAndroidIcons()