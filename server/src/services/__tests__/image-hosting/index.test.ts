import { describe, expect, test, jest, beforeEach } from '@jest/globals';
// import { ImageUploadOptions, ImageUploadResult } from '../../../services/image-hosting/types.js';

interface ImageUploadOptions {
  base64?: string;
  filePath?: string;
}

interface ImageUploadResult {
  success: boolean;
  url: string;
  error?: string;
}

const mockImgurUploadImage = jest.fn<() => Promise<ImageUploadResult>>();

jest.mock('../../../services/image-hosting/imgur.js', () => ({
  uploadImage: mockImgurUploadImage
}));

import uploadImage from '../../image-hosting/index.js';

describe('Image Hosting Service Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should export uploadImage function', () => {
    expect(typeof uploadImage).toBe('function');
  });

  test('should correctly forward calls to imgur uploadImage', async () => {
    const mockResult: ImageUploadResult = {
      success: true,
      url: 'https://example.com/image.jpg'
    };
    
    mockImgurUploadImage.mockResolvedValueOnce(mockResult);

    const options: ImageUploadOptions = { base64: 'test-data' };
    const result = await uploadImage(options);

    expect(mockImgurUploadImage).toHaveBeenCalledWith(options);
    expect(result).toEqual(mockResult);
  });
});