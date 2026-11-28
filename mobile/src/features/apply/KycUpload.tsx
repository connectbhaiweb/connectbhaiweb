/* One KYC document: pick a file or take a photo. The upload starts at once, while the person keeps typing; phone
   photos are shrunk first (longest side 1800 px, JPEG 0.82), as the website does. */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { View } from 'react-native';

import { API } from '../../lib/api';
import type { PickedFile, Upload } from '../../lib/api/types';
import { errMsg } from '../../lib/forms';
import { Field, inputStyle } from '../../ui/forms';
import { Button, Row } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

export type Kyc = { file: PickedFile; upload: Promise<Upload> };

const sizeOf = (uri: string, fallback = 0) => {
  try {
    return new File(uri).size ?? fallback;
  } catch {
    return fallback;
  }
};

async function shrinkImage(file: PickedFile, width?: number, height?: number): Promise<PickedFile> {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 600 * 1024) return file;
  try {
    const context = ImageManipulator.manipulate(file.uri);
    let image = width && height ? null : await context.renderAsync();
    const w = width || image!.width;
    const h = height || image!.height;
    if (Math.max(w, h) > 1800) {
      context.resize(w >= h ? { width: 1800 } : { height: 1800 });
      image = await context.renderAsync();
    } else image ||= await context.renderAsync();
    const out = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
    const size = sizeOf(out.uri, file.size);
    return size < file.size ? { uri: out.uri, name: file.name.replace(/\.\w+$/, '') + '.jpg', size, type: 'image/jpeg' } : file;
  } catch {
    return file;
  }
}

export function KycUpload({ label, value, onChange, error, testID }: { label: string; value: Kyc | null; onChange: (v: Kyc | null) => void; error?: string; testID?: string }) {
  const overlay = useOverlay();
  const [status, setStatus] = useState<'' | 'Uploading…' | 'Uploaded ✓'>('');

  const start = (file: PickedFile, width?: number, height?: number) => {
    setStatus('Uploading…');
    const upload = shrinkImage(file, width, height).then((f) => API.uploadFile(f, 'kyc'));
    onChange({ file, upload });
    upload.then(
      () => setStatus('Uploaded ✓'),
      (e) => {
        setStatus('');
        overlay.toast(errMsg(e), true);
      },
    );
  };

  const choose = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
      const a = r.assets?.[0];
      if (r.canceled || !a) return;
      start({ uri: a.uri, name: a.name, size: a.size ?? sizeOf(a.uri), type: a.mimeType || '' });
    } catch (e) {
      overlay.toast(errMsg(e), true);
    }
  };
  const photo = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return overlay.toast('Allow camera access to take a photo, or choose a file.', true);
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      const a = r.assets?.[0];
      if (r.canceled || !a) return;
      start({ uri: a.uri, name: (a.fileName || 'photo.jpg').replace(/\.(heic|heif)$/i, '.jpg'), size: a.fileSize ?? sizeOf(a.uri), type: a.mimeType || 'image/jpeg' }, a.width, a.height);
    } catch (e) {
      overlay.toast(errMsg(e), true);
    }
  };

  return (
    <Field label={label} error={error}>
      <View style={[inputStyle(!!error), { gap: 8, paddingVertical: 10 }]}>
        <Row>
          <Button testID={testID} label="Choose file" variant="soft" small onPress={choose} />
          <Button label="Take photo" variant="ghost" small onPress={photo} />
        </Row>
        <T s={14} c={value ? colors.ink : colors.muted} numberOfLines={1} raw={!!value}>{value ? value.file.name : 'No file chosen'}</T>
        {value && status ? <T s={14} c={status === 'Uploaded ✓' ? colors.ok : colors.muted}>{status}</T> : null}
      </View>
    </Field>
  );
}
