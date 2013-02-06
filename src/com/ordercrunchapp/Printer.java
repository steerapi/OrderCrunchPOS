package com.ordercrunchapp;

import io.trigger.forge.android.core.ForgeApp;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;

import com.ordercrunchapp.RasterDocument.RasPageEndMode;
import com.ordercrunchapp.RasterDocument.RasSpeed;
import com.ordercrunchapp.RasterDocument.RasTopMargin;
import com.starmicronics.stario.StarIOPort;
import com.starmicronics.stario.StarIOPortException;

public class Printer {

	public enum NarrowWide {
		_2_6, _3_9, _4_12, _2_5, _3_8, _4_10, _2_4, _3_6, _4_8
	};

	public enum BarCodeOption {
		No_Added_Characters_With_Line_Feed, Adds_Characters_With_Line_Feed, No_Added_Characters_Without_Line_Feed, Adds_Characters_Without_Line_Feed
	}

	public enum Min_Mod_Size {
		_2_dots, _3_dots, _4_dots
	};

	public enum NarrowWideV2 {
		_2_5, _4_10, _6_15, _2_4, _4_8, _6_12, _2_6, _3_9, _4_12
	};

	public enum CorrectionLevelOption {
		Low, Middle, Q, High
	};

	public enum Model {
		Model1, Model2
	};

	public enum Limit {
		USE_LIMITS, USE_FIXED
	};

	public enum CutType {
		FULL_CUT, PARTIAL_CUT, FULL_CUT_FEED, PARTIAL_CUT_FEED
	};

	public enum Alignment {
		Left, Center, Right
	};

	private static int printableArea = 576; // for raster data

	public static byte[] createRasterCommand(String printText, int textSize,
			int bold) {
		byte[] command;

		Paint paint = new Paint();
		paint.setStyle(Paint.Style.FILL);
		paint.setColor(Color.BLACK);
		paint.setAntiAlias(true);
		Typeface typeface = Typeface.create(Typeface.MONOSPACE, bold);
		paint.setTypeface(typeface);
		paint.setTextSize(textSize * 2);
		TextPaint textpaint = new TextPaint(paint);

		android.text.StaticLayout staticLayout = new StaticLayout(printText,
				textpaint, printableArea, Layout.Alignment.ALIGN_NORMAL, 1, 0,
				false);
		int height = staticLayout.getHeight();

		Bitmap bitmap = Bitmap.createBitmap(staticLayout.getWidth(), height,
				Bitmap.Config.RGB_565);
		Canvas c = new Canvas(bitmap);
		c.drawColor(Color.WHITE);
		c.translate(0, 0);
		staticLayout.draw(c);

		StarBitmap starbitmap = new StarBitmap(bitmap, false, printableArea);

		command = starbitmap.getImageRasterDataForPrinting();

		return command;
	}

	public static void printReceipt(String text) throws StarIOPortException {
		StarIOPort port = null;

		port = StarIOPort.getPort("USB:", "", 10000, ForgeApp.getActivity()
				.getApplicationContext());
		printableArea = 576; // Printable area in paper is 832(dot)

		RasterDocument rasterDoc = new RasterDocument(RasSpeed.Medium,
				RasPageEndMode.FeedAndFullCut, RasPageEndMode.FeedAndFullCut,
				RasTopMargin.Standard, 0, 0, 0);
		byte[] command = rasterDoc.BeginDocumentCommandData();
		port.writePort(command, 0, command.length);
		command = createRasterCommand(text, 13, 0);
		port.writePort(command, 0, command.length);
		command = rasterDoc.EndDocumentCommandData();
		port.writePort(command, 0, command.length);

	}
}
