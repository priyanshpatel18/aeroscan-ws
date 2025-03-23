import { PinataSDK } from "pinata";

export const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.GATEWAY_URL,
});


export async function upload(data: string) {
  try {
    const timestamp = Date.now();
    const blob = new Blob([data]);
    const file = new File([blob], `data_${timestamp}.txt`, { type: "text/plain" });

    const upload = await pinata.upload.public.file(file, {
      metadata: {
        name: `data_${timestamp}.txt`,
        keyvalues: {
          timestamp: timestamp.toString(),
        },
      },
      groupId: "ba28cf69-a75f-4fd5-aec4-6eeb13ea204c",
      vectorize: true,
    });
    console.log("File uploaded:", upload);
  } catch (error) {
    console.error("Upload failed:", error);
  }
}

export async function getData() {
  try {
    const data = await pinata.gateways.public.get("bafkreidvxxvkvyzmthir3apt4zuaaajza2ysdtbxmtmcvdiidijeblfcaq")
    console.log("Data fetched:", data);
  } catch (error) {
    console.log(error);
  }
}
