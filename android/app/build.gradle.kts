import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "net.naxlo.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "net.naxlo.android"
        minSdk = 24
        targetSdk = 35
        versionCode = (System.getenv("ANDROID_VERSION_CODE") ?: "1500").toInt()
        versionName = System.getenv("ANDROID_VERSION_NAME") ?: "1.5.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Unsigned in CI for now; checksums are published with the release.
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets {
        getByName("main") {
            // geoip.dat / geosite.dat are fetched into app/assets by CI at build time.
            assets.srcDirs("src/main/assets", "assets")
        }
    }
    buildFeatures { compose = true }
    packaging { resources.excludes += "META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.3")
    // libv2ray.aar (Xray-core bound with gomobile) is dropped into libs/ by CI.
    implementation(fileTree(mapOf("dir" to "libs", "include" to listOf("*.aar"))))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    // Password-protected (ZipCrypto + AES) config archives.
    implementation("net.lingala.zip4j:zip4j:2.11.5")
    testImplementation("junit:junit:4.13.2")
}
