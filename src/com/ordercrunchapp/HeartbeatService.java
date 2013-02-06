package com.ordercrunchapp;

import io.trigger.forge.android.core.ForgeApp;
import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.IBinder;
import android.util.Log;
//import com.instaops.android.Log;
//import com.instaops.android.MA;

public class HeartbeatService extends Service {
	public static final String TAG = HeartbeatService.class.getSimpleName();

	private final IBinder binder = new SampleLocalBinder();

	public class SampleLocalBinder extends Binder {
		public HeartbeatService getService() {
			return HeartbeatService.this;
		}
	}

	@Override
	public IBinder onBind(Intent intent) {
		return binder;
	}

	@Override
	public void onCreate() {
		super.onCreate();
		Log.d(TAG, "onCreate");

	}

	@Override
	public int onStartCommand(Intent intent, int flags, int startId) {
		Log.d(TAG, "onStartCommand");
		ForgeApp.event("stario.heartbeat");
		this.stopSelf();
		return START_STICKY;
	}

	@Override
	public void onDestroy() {
		Log.d(TAG, "onDestroy");

		super.onDestroy();
	}

	public void setAsForeground() {
		startForeground(Notif.notifId,
				Notif.getNotification(getApplicationContext()));
	}

	public void setAsBackground() {
		stopForeground(true);
	}

	// public HeartbeatService() {
	// super("com.ordercrunchapp.HeartbeatService");
	// }

	// @Override
	// public void onCreate() {
	// super.onCreate();
	// Intent notificationIntent = new Intent(this, ForgeActivity.class);
	// PendingIntent pendingIntent = PendingIntent.getActivity(this, 0,
	// notificationIntent, 0);
	// NotificationCompat.Builder mBuilder = new
	// NotificationCompat.Builder(this)
	// .setSmallIcon(R.drawable.ic_dialog_alert)
	// .setContentTitle("Event tracker")
	// .setContentText("Events received");
	// startForeground(1, mBuilder.build());
	// }
	//
	// @Override
	// protected void onHandleIntent(Intent intent) {
	// ForgeApp.event("heartbeat.pulse");
	// }

}
