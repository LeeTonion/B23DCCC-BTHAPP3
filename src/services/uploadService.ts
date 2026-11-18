import { PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { cloudinaryConfig } from './cloudinaryConfig';

export interface PickedImage {
  uri: string;
  fileName?: string;
  type?: string;
}

function extractAsset(res: ImagePickerResponse): PickedImage | null {
  if (res.didCancel) {
    return null;
  }
  if (res.errorCode) {
    throw new Error(res.errorMessage || 'Không thể chọn ảnh.');
  }
  const asset = res.assets?.[0];
  if (!asset?.uri) {
    return null;
  }
  return {
    uri: asset.uri,
    fileName: asset.fileName,
    type: asset.type,
  };
}

export async function pickImageFromCamera(): Promise<PickedImage | null> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Quyền truy cập Camera',
        message: 'Ứng dụng cần quyền camera để chụp ảnh gửi trong cuộc trò chuyện.',
        buttonPositive: 'Đồng ý',
        buttonNegative: 'Từ chối',
      },
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Bạn đã từ chối quyền truy cập camera.');
    }
  }
  const res = await launchCamera({
    mediaType: 'photo',
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8,
  });
  return extractAsset(res);
}

export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const res = await launchImageLibrary({
    mediaType: 'photo',
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8,
    selectionLimit: 1,
  });
  return extractAsset(res);
}

export async function uploadImageToCloudinary(
  uri: string,
  fileName = 'photo.jpg',
  mimeType = 'image/jpeg',
): Promise<string> {
  const { cloudName, uploadPreset } = cloudinaryConfig;
  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Chưa cấu hình Cloudinary (cloudName, uploadPreset) trong src/services/cloudinaryConfig.ts.',
    );
  }
  const form = new FormData();
  form.append('file', {
    uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);
  form.append('upload_preset', uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: form,
    },
  );
  const data = (await response.json()) as {
    secure_url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || 'Tải ảnh lên Cloudinary thất bại.');
  }
  return data.secure_url;
}
