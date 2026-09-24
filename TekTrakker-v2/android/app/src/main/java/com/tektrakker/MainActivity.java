package com.tektrakker;

import android.os.Bundle;
import android.view.Window;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
        registerPlugin(BackgroundLocationPermissionPlugin.class);
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required by the plugin to prove we properly wired the Native Activity
    }
}
