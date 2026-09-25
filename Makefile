# GUI_3DS - Root Makefile
# Provides targets for testing, host native parity, 3DS toolchain verification, and real 3DS build

.PHONY: all test native-parity 3ds-test 3ds clean

all: test native-parity

test:
	npm test

native-parity:
	node test/native/run_native_parity.mjs

3ds-test:
	node test/native/check_3ds_toolchain.mjs

3ds:
	node test/native/run_3ds_build.mjs

clean:
	node -e "const fs = require('fs'); fs.rmSync('build', { recursive: true, force: true }); fs.rmSync('test/native/build', { recursive: true, force: true });"
