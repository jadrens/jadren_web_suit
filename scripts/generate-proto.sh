#!/bin/sh
# Regenerates src/gen from proto/ with protoc and protoc-gen-es.
set -eu
cd "$(dirname "$0")/.."
rm -rf src/gen
mkdir -p src/gen
protoc -I proto \
  --plugin=protoc-gen-es=node_modules/.bin/protoc-gen-es \
  --es_out=src/gen --es_opt=target=ts \
  $(find proto -name '*.proto')
