package com.tektrakker;

import android.Manifest;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.PermissionState;

@CapacitorPlugin(
    name = "BackgroundLocationPermission",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION },
            alias = "backgroundLocation"
        )
    }
)
public class BackgroundLocationPermissionPlugin extends Plugin {

    @PluginMethod
    public void checkBackgroundPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            boolean granted = getPermissionState("backgroundLocation") == PermissionState.GRANTED;
            ret.put("granted", granted);
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBackgroundPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            requestPermissionForAlias("backgroundLocation", call, "backgroundPermissionCallback");
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void backgroundPermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = getPermissionState("backgroundLocation") == PermissionState.GRANTED;
        ret.put("granted", granted);
        call.resolve(ret);
    }
}
