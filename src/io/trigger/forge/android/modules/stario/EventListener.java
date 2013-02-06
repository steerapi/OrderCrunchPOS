package io.trigger.forge.android.modules.stario;

import io.trigger.forge.android.core.ForgeApp;
import io.trigger.forge.android.core.ForgeEventListener;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;

import com.ordercrunchapp.HeartbeatService;
import com.ordercrunchapp.HeartbeatService.SampleLocalBinder;

public class EventListener extends ForgeEventListener {
	private static final String TAG = EventListener.class.getSimpleName();
	private PowerManager.WakeLock wl;

	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		// ForgeApp.event("alert.resume", null);
		Intent serviceIntent = new Intent(ForgeApp.getActivity()
				.getApplicationContext(), HeartbeatService.class);
		ForgeApp.getActivity().startService(serviceIntent);
		ForgeApp.getActivity().bindService(serviceIntent, serviceConnection,
				Context.BIND_AUTO_CREATE);

		PowerManager pm = (PowerManager) ForgeApp.getActivity()
				.getApplicationContext()
				.getSystemService(Context.POWER_SERVICE);
		wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK
				| PowerManager.ON_AFTER_RELEASE, TAG);
		wl.acquire();
	}

	@Override
	public void onDestroy() {
		// TODO Auto-generated method stub
		super.onDestroy();
		wl.release();
	}

	private ServiceConnection serviceConnection = new ServiceConnection() {
		protected boolean bound;

		@Override
		public void onServiceDisconnected(ComponentName name) {
			bound = false;
		}

		@Override
		public void onServiceConnected(ComponentName name, IBinder service) {
			SampleLocalBinder binder = (SampleLocalBinder) service;
			HeartbeatService sampleService = binder.getService();
			sampleService.setAsForeground();
			bound = true;
		}
	};
}
