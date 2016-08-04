build:
	rm -rf lib
	mkdir -p lib
	`npm bin`/babel src --out-dir lib
	cp src/index.js lib/index.js.flow

check:
	flow check src/
	eslint src/
