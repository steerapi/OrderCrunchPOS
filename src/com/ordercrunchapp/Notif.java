package com.ordercrunchapp;

import io.trigger.forge.android.core.ForgeActivity;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

public class Notif {

	public static int notifId = 654654;

	public static Notification getNotification(Context context) {

		Notification n = new Notification(
				com.ordercrunchapp.pos.R.drawable.ic_launcher,
				"OrderCrunch POS", System.currentTimeMillis());

		PendingIntent pendingIntent = PendingIntent.getActivity(context, 0,
				new Intent(context, ForgeActivity.class), 0);
		n.setLatestEventInfo(context, "OrderCrunch POS",
				"service is running...", pendingIntent);

		return n;
	}

	public static void cancel(Context context) {
		NotificationManager nm = (NotificationManager) context
				.getSystemService(Context.NOTIFICATION_SERVICE);

		nm.cancel(notifId);
	}

}