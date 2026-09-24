# Add project specific ProGuard / R8 rules here.

# Preserve Capacitor Bridge & Native Plugin Reflection Interfaces
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# Preserve JavaScript Interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# R8 Optimization Pass Controls
-optimizationpasses 5
-allowaccessmodification
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
