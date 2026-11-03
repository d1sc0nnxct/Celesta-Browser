using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;

// Celesta launcher: starts the local start-page server if needed, then the built browser.
internal static class Program
{
    private const string FirefoxRel = @"gecko\obj-ff\dist\bin\firefox.exe";
    private const string ProfileRel = @"gecko\obj-ff\dist\bin\profile-celesta";
    private const int Port = 8742;

    [STAThread]
    private static void Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string firefox = Path.Combine(root, FirefoxRel);
        string profile = Path.Combine(root, ProfileRel);

        if (!File.Exists(firefox))
        {
            MessageBoxFallback("Celesta needs a build first:\n\n" + firefox +
                               "\n\nRun ./mach build in the gecko tree.");
            return;
        }

        EnsureServer(root);
        Thread.Sleep(400);

        var psi = new ProcessStartInfo(firefox)
        {
            UseShellExecute = false,
            WorkingDirectory = Path.GetDirectoryName(firefox),
            Arguments = "-no-remote -profile \"" + profile + "\"" +
                        " --window-size=1280,860 \"http://127.0.0.1:" + Port + "/index.html\""
        };

        try { Process.Start(psi); }
        catch (Exception ex) { MessageBoxFallback("Could not start Celesta:\n\n" + ex.Message); }
    }

    private static void EnsureServer(string root)
    {
        if (PortOpen()) return;

        string home = Path.Combine(root, "home");
        if (!Directory.Exists(home)) return;

        string[] pythons =
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                         @"Programs\Python\Python312\python.exe"),
            "python.exe",
            "py.exe"
        };

        foreach (string python in pythons)
        {
            try
            {
                var psi = new ProcessStartInfo(python)
                {
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WorkingDirectory = home,
                    Arguments = "-m http.server " + Port + " --bind 127.0.0.1 --directory \"" + home + "\""
                };
                Process.Start(psi);
                for (int i = 0; i < 40 && !PortOpen(); i++) Thread.Sleep(100);
                if (PortOpen()) return;
            }
            catch { }
        }
    }

    private static bool PortOpen()
    {
        try
        {
            using (var client = new TcpClient())
            {
                var task = client.ConnectAsync(IPAddress.Loopback, Port);
                return task.Wait(250) && client.Connected;
            }
        }
        catch { return false; }
    }

    private static void MessageBoxFallback(string text)
    {
        try
        {
            File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "celesta-launch.log"),
                               DateTime.Now + "  " + text + Environment.NewLine);
        }
        catch { }
    }
}
