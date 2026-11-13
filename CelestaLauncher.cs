using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;

// Celesta launcher: opens the built browser on the packaged start page.
// The page is set as the homepage because Firefox will not accept a chrome://
// URL as the startup argument (it opens about:blank and exits).
internal static class Program
{
    private const string StartPage = "about:newtab";
    private const string ReleasesLatestUrl = "https://api.github.com/repos/d1sc0nnxct/Celesta-Browser/releases/latest";
    private const string RegistryUninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Celesta";
    // the version baked into installer\celesta.nsi; used when the registry has none (portable/dev run)
    private const string FallbackVersion = "0.2.1";

    private static readonly string[] UserPrefs =
    {
        "user_pref(\"browser.startup.page\", 1);",
        "user_pref(\"browser.startup.homepage\", \"" + StartPage + "\");",
        "user_pref(\"browser.startup.homepage_override.mstone\", \"ignore\");",
        "user_pref(\"browser.aboutwelcome.enabled\", false);",
        "user_pref(\"browser.shell.checkDefaultBrowser\", false);",
        "user_pref(\"browser.shell.didSkipDefaultBrowserCheckOnFirstRun\", true);",
        "user_pref(\"datareporting.policy.dataSubmissionEnabled\", false);",
        "user_pref(\"datareporting.healthreport.uploadEnabled\", false);",
        "user_pref(\"toolkit.telemetry.enabled\", false);",
        "user_pref(\"toolkit.telemetry.unified\", false);",
        "user_pref(\"app.shield.optoutstudies.enabled\", false);",
        "user_pref(\"browser.newtabpage.activity-stream.feeds.section.topstories\", false);",
        "user_pref(\"browser.newtabpage.activity-stream.showSponsored\", false);",
        "user_pref(\"extensions.pocket.enabled\", false);",
        "user_pref(\"browser.tabs.inTitlebar\", 1);",
    };

    [STAThread]
    private static void Main(string[] args)
    {
        if (CheckForUpdate()) return;   // installer launched; let it replace this install

        string root = AppDomain.CurrentDomain.BaseDirectory;
        string firefox = FirstExisting(
            Path.Combine(root, @"browser\firefox.exe"),
            Path.Combine(root, @"gecko\obj-ff\dist\bin\firefox.exe"));
        if (firefox == null)
        {
            Log("No browser found. Expected browser\\firefox.exe or gecko\\obj-ff\\dist\\bin\\firefox.exe under " + root);
            return;
        }

        string profile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Celesta", "profile");
        Directory.CreateDirectory(profile);

        WriteUserJs(profile);
        RemoveUserChrome(profile);

        var psi = new ProcessStartInfo(firefox)
        {
            UseShellExecute = false,
            WorkingDirectory = Path.GetDirectoryName(firefox),
            Arguments = "-no-remote -profile \"" + profile + "\" --window-size=1280,860"
        };

        try { Process.Start(psi); }
        catch (Exception ex) { Log("Could not start Celesta: " + ex.Message); }
    }

    private static void WriteUserJs(string profile)
    {
        try
        {
            File.WriteAllText(Path.Combine(profile, "user.js"),
                "// Celesta defaults, rewritten on every launch.\n" +
                string.Join("\n", UserPrefs) + "\n", new UTF8Encoding(false));
        }
        catch (Exception ex) { Log("user.js: " + ex.Message); }
    }

    // earlier builds hid the whole browser chrome here; make sure a profile
    // created by one of those gets its toolbars back
    private static void RemoveUserChrome(string profile)
    {
        try
        {
            string css = Path.Combine(profile, "chrome", "userChrome.css");
            if (File.Exists(css)) File.Delete(css);
        }
        catch (Exception ex) { Log("userChrome.css: " + ex.Message); }
    }

    // GitHub Releases is the update source: if a newer tag than the installed
    // DisplayVersion has a .exe asset, offer to download and run it. Swallows
    // every failure (no network, no registry key, bad response) and just lets
    // the current build launch instead.
    private static bool CheckForUpdate()
    {
        try
        {
            string installed = GetInstalledVersion();
            var task = Task.Run(() => FetchLatestRelease());
            if (!task.Wait(3000)) return false;   // offline or slow: never delay a normal launch
            ReleaseInfo? latest = task.Result;
            if (latest == null || new Version(latest.Value.Version) <= new Version(installed)) return false;

            var choice = MessageBox.Show(
                "Celesta " + latest.Value.Version + " is available (you have " + installed + ").\nUpdate now?",
                "Celesta update", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
            if (choice != DialogResult.Yes) return false;

            string setupPath = Path.Combine(Path.GetTempPath(), "Celesta-Setup-" + latest.Value.Version + ".exe");
            using (var wc = new WebClient())
            {
                wc.Headers.Add("User-Agent", "Celesta-updater");
                wc.DownloadFile(latest.Value.DownloadUrl, setupPath);
            }
            Process.Start(setupPath);   // NSIS prompts for UAC and overwrites this install
            return true;
        }
        catch (Exception ex) { Log("update check: " + ex.Message); return false; }
    }

    private static string GetInstalledVersion()
    {
        try
        {
            using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(RegistryUninstallKey))
            {
                var v = key == null ? null : key.GetValue("DisplayVersion") as string;
                if (!string.IsNullOrEmpty(v)) return v;
            }
        }
        catch { }
        return FallbackVersion;   // not installed via the NSIS installer (dev/portable run)
    }

    private struct ReleaseInfo { public string Version; public string DownloadUrl; }

    private static ReleaseInfo? FetchLatestRelease()
    {
        using (var wc = new WebClient())
        {
            wc.Headers.Add("User-Agent", "Celesta-updater");
            string json = wc.DownloadString(ReleasesLatestUrl);
            var tag = Regex.Match(json, "\"tag_name\"\\s*:\\s*\"v?([0-9.]+)\"");
            var url = Regex.Match(json, "\"browser_download_url\"\\s*:\\s*\"([^\"]+\\.exe)\"");
            if (!tag.Success || !url.Success) return null;
            return new ReleaseInfo { Version = tag.Groups[1].Value, DownloadUrl = url.Groups[1].Value };
        }
    }

    private static string FirstExisting(params string[] paths)
    {
        foreach (string p in paths) if (File.Exists(p)) return p;
        return null;
    }

    private static void Log(string text)
    {
        try
        {
            File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "celesta-launch.log"),
                               DateTime.Now + "  " + text + Environment.NewLine);
        }
        catch { }
    }
}
