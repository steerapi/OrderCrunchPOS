package io.trigger.forge.android.modules.stario;

import io.trigger.forge.android.core.ForgeApp;
import io.trigger.forge.android.core.ForgeParam;
import io.trigger.forge.android.core.ForgeTask;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.SharedPreferences.Editor;

import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import com.ordercrunchapp.HeartbeatService;
import com.ordercrunchapp.Printer;
import com.starmicronics.stario.StarIOPort;
import com.starmicronics.stario.StarIOPortException;
import com.starmicronics.stario.StarPrinterStatus;

public class API {
	public static AlarmManager alarmManager = null;
	public static PendingIntent pendingIntent = null;

	private static final String USER_DETAILS = "userdetails";
	private static final String PASS_PREF = "password";
	private static final String USERNAME_PREF = "username";

	public static void saveUserDetails(final ForgeTask task,
			@ForgeParam("username") final String username,
			@ForgeParam("password") final String password) {

		SharedPreferences userdetails = ForgeApp.getActivity()
				.getSharedPreferences(USER_DETAILS, Context.MODE_PRIVATE);
		Editor editor = userdetails.edit();
		editor.putString(USERNAME_PREF, username);
		editor.putString(PASS_PREF, password);
		editor.commit();
	}

	public static void getUserDetails(final ForgeTask task) {
		// TODO Auto-generated method stub
		SharedPreferences userdetails = ForgeApp.getActivity()
				.getSharedPreferences(USER_DETAILS, Context.MODE_PRIVATE);
		String username = userdetails.getString(USERNAME_PREF, "unknown");
		String password = userdetails.getString(PASS_PREF, "unknown");
		JsonObject json = new JsonObject();
		json.add("username", new JsonPrimitive(username));
		json.add("password", new JsonPrimitive(password));
		task.success(json);
	}

	public static void startHeartbeat(final ForgeTask task,
			@ForgeParam("interval") final int interval) {
		// int interval = Integer.parseInt(intervalStr);
		Context context = ForgeApp.getActivity().getApplicationContext();
		Intent intent = new Intent(context.getApplicationContext(),
				HeartbeatService.class);
		alarmManager = (AlarmManager) context.getApplicationContext()
				.getSystemService(Context.ALARM_SERVICE);
		pendingIntent = PendingIntent.getService(
				context.getApplicationContext(), 987654321, intent, 0);
		try {
			alarmManager.cancel(pendingIntent);
		} catch (Exception e) {
			task.error(e.toString(), "UNEXPECTED_FAILURE", "ALARM_ERROR");
		}
		alarmManager.setRepeating(AlarmManager.RTC_WAKEUP,
				System.currentTimeMillis() + interval, interval, pendingIntent);
		task.success();
	}

	public static void stopHeartbeat(final ForgeTask task) {
		if (alarmManager != null && pendingIntent != null) {
			try {
				alarmManager.cancel(pendingIntent);
			} catch (Exception e) {
				task.error(e.toString(), "UNEXPECTED_FAILURE", "ALARM_ERROR");
			}
		}
		task.success();
	}

	public static void checkStatus(final ForgeTask task) {
		StarIOPort port = null;
		try {
			/*
			 * using StarIOPort3.1.jar (support USB Port) Android OS Version:
			 * upper 2.2
			 */
			port = StarIOPort.getPort("USB:", "", 10000, ForgeApp.getActivity()
					.getApplicationContext());

			try {
				Thread.sleep(500);
			} catch (InterruptedException e) {
				task.error(e.toString(), "UNEXPECTED_FAILURE", "INTERRUPTED");
			}

			StarPrinterStatus status = port.retreiveStatus();
			JsonObject json = new JsonObject();
			if (status.offline != false) {
				json.add("status", new JsonPrimitive("offline"));
			} else {
				json.add("status", new JsonPrimitive("online"));
			}
			task.success(json);
		} catch (StarIOPortException e) {
			JsonObject json = new JsonObject();
			json.add("status", new JsonPrimitive("offline"));
			task.success(json);
//			task.error(e.toString(), "UNEXPECTED_FAILURE", "PRINTER_ERROR");
		} finally {
			if (port != null) {
				try {
					StarIOPort.releasePort(port);
				} catch (StarIOPortException e) {
					JsonObject json = new JsonObject();
					json.add("status", new JsonPrimitive("offline"));
					task.success(json);
//					task.error(e.toString(), "UNEXPECTED_FAILURE",
//							"PRINTER_ERROR");
				}
			}
		}
	}

	public static void printReceipt(final ForgeTask task,
			@ForgeParam("text") final String text) {
		try {
			Printer.printReceipt(text);
			task.success();
		} catch (StarIOPortException e) {
			task.error(e.toString(), "UNEXPECTED_FAILURE", "PRINTER_ERROR");
		}
	}
}
