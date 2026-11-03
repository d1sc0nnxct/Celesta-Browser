using System;
using System.Diagnostics;
using System.IO;
using System.Text;

// Celesta launcher: starts the built browser with the packaged start page.
// The page is set as the homepage because Firefox will not accept a chrome://
// URL as the startup argument (it opens as about:blank and exits).
internal static class Program
{
    private const string StartPage = "chrome://celesta/content/index.html";

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
        "user_pref(\"browser.tabs.inTitlebar\", 0);",
        "user_pref(\"toolkit.legacyUserProfileCustomizations.stylesheets\", true);",
    };

    [STAThread]
    private static void Main(string[] args)
    {
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
        WriteUserChrome(profile);

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

    private static void WriteUserChrome(string profile)
    {
        try
        {
            string chrome = Path.Combine(profile, "chrome");
            Directory.CreateDirectory(chrome);
            File.WriteAllText(Path.Combine(chrome, "userChrome.css"),
                "@namespace url(\"http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul\");\n" +
                "#TabsToolbar, #titlebar, #navigator-toolbox, #PersonalToolbar, #urlbar-container, #searchbar { display: none !important; }\n" +
                "#main-window { background: #000 !important; }\n");
        }
        catch (Exception ex) { Log("userChrome.css: " + ex.Message); }
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
