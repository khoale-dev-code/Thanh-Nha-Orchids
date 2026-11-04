# Thanh Nha: Android LAN printing V21

## What this update adds

- `/printer`: a printer preparation screen with model, LAN IP, port and paper width. The profile is stored **only in localStorage of that Android browser**, not in Supabase.
- `Settings > Applications & integrations`: a shortcut to the printer screen.
- `/print/[id]`: **In qua app Android** button uses the existing PNG receipt and the Android Web Share file chooser. Choose RawBT or an installed compatible printing app to print.
- `Gui phieu in thu` provides a synthetic test receipt, without customer information, through the same Android share chooser.
- No schema migration and no change to order creation/payment logic.

## Limitations that must be understood

ZY-Q822 label says **USB+LAN**, not Bluetooth. A hosted HTTPS PWA does not have general raw TCP sockets and cannot directly send ESC/POS commands to `192.168.1.x:9100`. Saving an IP in the browser is **not** a network pairing or connection test. Never show `connected` merely because the form was saved or Android share sheet was opened. The printer app must be configured separately with the **verified IP of the actual printer** and appropriate paper width.

The observed `192.168.1.222:9100` came from an existing Android app's configuration. It has **not** yet been proven to be the real printer IP. The Android device was `192.168.1.231/24` in the same Wi-Fi segment, but LAN connectivity was not demonstrated.

### Steps

1. Connect printer RJ45 to router LAN. Connect Android to the same LAN/Wi-Fi network (not guest-isolated).
2. Verify the printer's actual LAN IP using router's device list or manufacturer's USB configuration utility.
3. In a compatible Android print app such as RawBT set Wi-Fi/LAN, printer IP, port 9100 **if the printer uses it**, ESC/POS, 80mm. Test the application's own connection and print.
4. In Thanh Nha `/printer`, save the printer information for reference and use `Gui phieu in thu` to share an image directly to the print app.
5. After closing an order, tap `In qua app Android` in its receipt screen. Select the printing app from Android share chooser. Receipt is transmitted as a PNG image to the chosen app for printing.

Direct one-tap automatic LAN printing with no chooser requires a separate installed Android companion app, native wrapper, or trusted LAN print bridge. That functionality is **not** implemented in this V21 patch. The public Vercel server cannot access a printer on a private home LAN.

## QA checklist

- Build/typecheck, verify `/printer`, save/reload on same Android, invalid IP/port validation.
- Confirm share sheet on Android with a supported print app installed; test-print from app and paper 80mm.
- On browsers without file sharing confirm PNG fallback download.
- Confirm existing `In hoa don 80mm`, `Chia se anh`, `Luu anh PNG` actions unchanged.
- Check no sensitive customer data enters printer profile or diagnostics. Receipt PNG intentionally contains order details when user initiates sharing.
