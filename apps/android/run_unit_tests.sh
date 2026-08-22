#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build/standalone_test"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/classes"

COMPILER_JAR="/Users/Apoorva/.gradle/caches/modules-2/files-2.1/org.jetbrains.kotlin/kotlin-compiler-embeddable/1.9.22/9cd4dc7773cf2a99ecd961a88fbbc9a2da3fb5e1/kotlin-compiler-embeddable-1.9.22.jar"
TROVE_JAR="/Users/Apoorva/.gradle/caches/modules-2/files-2.1/org.jetbrains.intellij.deps/trove4j/1.0.20200330/3afb14d5f9ceb459d724e907a21145e8ff394f02/trove4j-1.0.20200330.jar"
STDLIB_JAR="/Users/Apoorva/.gradle/caches/modules-2/files-2.1/org.jetbrains.kotlin/kotlin-stdlib/2.3.0/ebc4eb2b6e6c91b6c844c1e3183920d86f2ef656/kotlin-stdlib-2.3.0.jar"
ANNOTATIONS_JAR="/Users/Apoorva/.gradle/caches/modules-2/files-2.1/org.jetbrains/annotations/13.0/919f0dfe192fb4e063e7dacadee7f8bb9a2672a9/annotations-13.0.jar"
GSON_JAR="/Users/Apoorva/.gradle/caches/modules-2/files-2.1/com.google.code.gson/gson/2.11.0/527175ca6d81050b53bdd4c457a6d6e017626b0e/gson-2.11.0.jar"
JUNIT_JAR="/Users/Apoorva/.m2/repository/junit/junit/4.13.2/junit-4.13.2.jar"
HAMCREST_JAR="/Users/Apoorva/.m2/repository/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar"

CP="$STDLIB_JAR:$ANNOTATIONS_JAR:$GSON_JAR:$JUNIT_JAR:$HAMCREST_JAR"

echo "Compiling Kotlin sources..."
java -cp "$COMPILER_JAR:$TROVE_JAR:$STDLIB_JAR:$ANNOTATIONS_JAR" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler \
  -no-stdlib \
  -Xskip-metadata-version-check \
  -cp "$CP" \
  -d "$BUILD_DIR/classes" \
  "$DIR/app/src/main/java/com/onshift/app/data/vault/EvidenceRepository.kt" \
  "$DIR/app/src/main/java/com/onshift/app/data/vault/EncryptedEvidenceStore.kt" \
  "$DIR/app/src/main/java/com/onshift/app/data/vault/LocalEncryptedEvidenceRepository.kt" \
  "$DIR/app/src/main/java/com/onshift/app/data/hashchain/HashChain.kt" \
  "$DIR/app/src/main/java/com/onshift/app/notifications/NotificationModels.kt" \
  "$DIR/app/src/main/java/com/onshift/app/notifications/NotificationParser.kt" \
  "$DIR/app/src/main/java/com/onshift/app/notifications/ZomatoParser.kt" \
  "$DIR/app/src/main/java/com/onshift/app/notifications/SwiggyParser.kt" \
  "$DIR/app/src/main/java/com/onshift/app/notifications/UberParser.kt" \
  "$DIR/app/src/main/java/com/onshift/app/notifications/GenericParser.kt" \
  "$DIR/app/src/main/java/com/onshift/app/notifications/PlatformRegistry.kt" \
  "$DIR/app/src/test/java/com/onshift/app/HashChainTest.kt" \
  "$DIR/app/src/test/java/com/onshift/app/LiveDemoTest.kt" \
  "$DIR/app/src/test/java/com/onshift/app/NotificationParserTest.kt" \
  "$DIR/app/src/test/java/com/onshift/app/EvidencePersistenceTest.kt" \
  "$DIR/app/src/test/java/com/onshift/app/EndToEndPersistenceVerificationTest.kt"

echo "Running JUnit tests..."
java -cp "$BUILD_DIR/classes:$CP" org.junit.runner.JUnitCore \
  com.onshift.app.HashChainTest \
  com.onshift.app.LiveDemoTest \
  com.onshift.app.notifications.NotificationParserTest \
  com.onshift.app.EvidencePersistenceTest \
  com.onshift.app.EndToEndPersistenceVerificationTest

