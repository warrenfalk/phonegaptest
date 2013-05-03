SET INKSCAPE="C:\Program Files (x86)\Inkscape\inkscape.exe"
%INKSCAPE% --file=android.svg --export-png=android\inpos-android-36.png --export-area-page --export-width=36 --export-height=36 --export-use-hints --export-background-opacity=0
%INKSCAPE% --file=android.svg --export-png=android\inpos-android-48.png --export-area-page --export-width=48 --export-height=48 --export-use-hints --export-background-opacity=0
%INKSCAPE% --file=android.svg --export-png=android\inpos-android-72.png --export-area-page --export-width=72 --export-height=72 --export-use-hints --export-background-opacity=0
%INKSCAPE% --file=android.svg --export-png=android\inpos-android-96.png --export-area-page --export-width=96 --export-height=96 --export-use-hints --export-background-opacity=0
%INKSCAPE% --file=android.svg --export-png=android\inpos-android-144.png --export-area-page --export-width=144 --export-height=144 --export-use-hints --export-background-opacity=0


%INKSCAPE% --file=ios.svg --export-png=ios\inpos-ios-57.png --export-area-page --export-width=57 --export-height=57 --export-use-hints --export-background-opacity=0
%INKSCAPE% --file=ios.svg --export-png=ios\inpos-ios-72.png --export-area-page --export-width=72 --export-height=72 --export-use-hints --export-background-opacity=0
%INKSCAPE% --file=ios.svg --export-png=ios\inpos-ios-114.png --export-area-page --export-width=114 --export-height=114 --export-use-hints --export-background-opacity=0
%INKSCAPE% --file=ios.svg --export-png=ios\inpos-ios-144.png --export-area-page --export-width=144 --export-height=144 --export-use-hints --export-background-opacity=0

copy android\inpos-android-36.png ..\..\..\res\drawable-ldpi\icon.png
copy android\inpos-android-48.png ..\..\..\res\drawable-mdpi\icon.png
copy android\inpos-android-72.png ..\..\..\res\drawable-hdpi\icon.png
copy android\inpos-android-96.png ..\..\..\res\drawable-xhdpi\icon.png
copy android\inpos-android-96.png ..\..\..\res\drawable\icon.png