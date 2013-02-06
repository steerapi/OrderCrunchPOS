COFFEE = $(shell find ./code -name "*.coffee" -type f)

STYL = $(shell find ./code -name "*.styl" -type f)

JADE = $(shell find ./code -name "*.jade" -type f)

all: ./src/index.html ./src/index.js ./src/index.css

run:
	http-server ./src

watch:
	watch -n 1 make

./src/index.html: $(JADE)
	jade -p . ./code/index.jade -O ./src

./src/index.css: $(STYL)
	stylus -I . ./code/index.styl --include-css -o ./src

./src/index.js: $(COFFEE)
	browserify ./code/index.coffee -o ./src/index.js

clean:
	rm -f ./src/index.html
	rm -f ./src/index.css
	rm -f ./src/index.js

.PHONY: clean run watchs