build:
	rm -rf lib
	mkdir -p lib
	`npm bin`/babel src --out-dir lib
	cp src/index.js lib/index.js.flow
	cp src/defer.js lib/defer.js.flow

check:
	flow check src/
	eslint src/
