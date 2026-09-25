# GUI_3DS - Makefile
# Targets for testing and native Citro2D / devkitARM compilation verification

.PHONY: all test native-test clean

all: test native-test

test:
	npm test

native-test:
	node test/run_native_build.mjs

clean:
	node -e "const fs = require('fs'); fs.rmSync('test/native/build', { recursive: true, force: true });"
