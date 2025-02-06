import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Clipboard, Menu, showToast, Toasts } from "@webpack/common";

function PopOverIcon() {
    return (
        <svg
            width={24} height={24}
            viewBox={"0 0 64 64"}
            fill="currentColor"
        >
            <path d="M32.834,22.126H18.668v-11h6l-11-11l-11,11h6v11H1.5c-0.828,0-1.5,0.671-1.5,1.5v9.082c0,0.829,0.672,1.5,1.5,1.5h31.334   c0.827,0,1.5-0.671,1.5-1.5v-9.082C34.334,22.797,33.661,22.126,32.834,22.126z M26.729,28.167h-2v-2h2V28.167z M30.168,28.167h-2   v-2h2V28.167z" />
        </svg>
    );
}

const messageCtxPatch: NavContextMenuPatchCallback = (children, { message, itemSafeSrc, mediaItem, ...rest }) => {
    let { chibisafeUrl, apiToken, defaultAlbumId, copyToClickboard } = settings.use(["chibisafeUrl", "apiToken", "defaultAlbumId", "copyToClickboard"]);
    if (!chibisafeUrl || !apiToken) return null;

    // Prefer mediaItem proxy over itemSafeSrc
    let mediaSrc = itemSafeSrc;
    if (mediaItem) {
        mediaSrc = mediaItem.proxyUrl;
    }

    const group = findGroupChildrenByChildId("forward", children);
    if (!group || (!mediaSrc && !message.content)) return;

    let injectPosition = group.findIndex(c => c?.props?.id === "forward");

    group.splice(injectPosition + 1, 0, (
        <Menu.MenuItem
            id="vc-send-chibi-text"
            label={"Send To Chibi As " + (!mediaSrc ? "Text" : "File")}
            icon={PopOverIcon}
            action={async () => {
                let messageContent: Blob;
                let fileName: string;
                // If not media item, send content as text
                showToast("Uploading... This might take a while.", Toasts.Type.MESSAGE);
                if (!mediaSrc) {
                    messageContent = new Blob([message.content], { type: "text/plain" });
                    fileName = `${message.author.username}${message.id}.txt`;
                } else {
                    try {
                        let response = await fetch(mediaSrc);
                        messageContent = await response.blob();
                    } catch {
                        showToast("Failed to download file. See console", Toasts.Type.FAILURE);
                        return;
                    }
                    fileName = mediaSrc;

                    if (fileName.includes("?")) {
                        fileName = fileName.split("?")[0];
                    }

                    let splitSections = fileName.split("/");
                    fileName = splitSections[splitSections.length - 1];
                    fileName = `${message.id}-${fileName}`;
                }

                let formData = new FormData();
                formData.append("files[]", messageContent, fileName);

                let options = {
                    body: formData,
                    headers: {
                        "x-api-key": apiToken
                    },
                    method: "POST"
                };

                if (defaultAlbumId) {
                    options.headers["albumuuid"] = defaultAlbumId;
                }

                let response = await fetch(`${chibisafeUrl}/api/upload`, options);
                let json = await response.json();
                if (response.status !== 200) {
                    showToast(`Failed to upload ${fileName}. See console.`, Toasts.Type.FAILURE);
                    console.error(response);
                    return;
                }

                if (copyToClickboard) {
                    Clipboard.copy(json.url);
                }
                showNotification({
                    title: "Successfully Uploaded",
                    body: "Successfully uploaded to ChibiSafe. " + (copyToClickboard ? "URL copied to clipboard" : "Click here to copy URL"),
                    permanent: false,
                    noPersist: true,
                    color: "var(--green-360)",
                    onClick() {
                        Clipboard.copy(json.url);
                    },
                });
            }}
        />
    ));
};
const settings = definePluginSettings(
    {
        chibisafeUrl: {
            type: OptionType.STRING,
            description: "URL of your chibisafe instance",
            placeholder: "https://chibi.example.com"
        },
        apiToken: {
            type: OptionType.STRING,
            description: "API Token of your Chibisafe",
            placeholder: "Enter your API Key"
        },
        defaultAlbumId: {
            type: OptionType.STRING,
            description: "Default Album ID to upload",
            placeholder: "Enter your Album UUID"
        },
        copyToClickboard: {
            type: OptionType.BOOLEAN,
            description: "Should copy to clipboard by default?",
            default: true
        },
    }
);

export default definePlugin({
    name: "Send To Chibisafe",
    description: "It adds the ability to send user uploaded images to ChibiSafe",
    authors: [{
        id: 877141719735476255n,
        name: "Kutup Tilkisi"
    }],
    settings,
    contextMenus: {
        "message": messageCtxPatch
    }
});

