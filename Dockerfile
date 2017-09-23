FROM debian:sid
LABEL Description="This image is used to run emscripten" Version="0.1"
RUN apt-get -yq update && >/dev/null apt-get -yq --no-install-suggests --no-install-recommends --allow-downgrades --allow-remove-essential --allow-change-held-packages install  build-essential cmake python2.7 default-jre clang-3.8 llvm-runtime llvm-3.8 libicu57 libstdc++6 nodejs clang llvm node-uglify
RUN ln /usr/bin/python2.7 /usr/bin/python || true
RUN mkdir -p /usr/src/github
COPY . /usr/src/github/glibc
RUN cd /usr/src/github/glibc/emsdk-portable/; >/dev/null ./emsdk update; >/dev/null ./emsdk install latest; >/dev/null ./emsdk activate latest
RUN DIR=/usr/src/github/glibc/emsdk-portable; source $DIR/emsdk_env.sh; $DIR/emcc -v
CMD cd /usr/src/github/glibc/posix; DIR=../emsdk-portable; source $DIR/emsdk_env.sh; $DIR/emcc -O2 -o regex_internal.js regex_internal.c; $DIR/emcc -O2 -o regexec.js regexec.c; cat regex_internal.js regexec.js
