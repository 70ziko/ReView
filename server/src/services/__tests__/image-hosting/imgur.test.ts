import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockUpload = jest.fn<() => Promise<{ success: boolean; data?: { link: string } }>>();
const mockImgurClient = jest.fn().mockImplementation(() => ({
  upload: mockUpload
}));
const mockReadFile = jest.fn<() => Promise<Buffer>>();

jest.mock('imgur', () => ({
  ImgurClient: mockImgurClient
}));

jest.mock('fs/promises', () => ({
  readFile: mockReadFile
}));

import { uploadImage } from '../../../services/image-hosting/imgur.js';

describe('Image Upload Service', () => {
  const mockSuccessResponse = {
    success: true,
    data: { link: 'https://example.com/image.jpg' }
  };

  const mockErrorResponse = {
    success: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.IMGUR_CLIENT_ID = 'test-client-id';
  });

  test('should upload a base64 image successfully', async () => {
    mockUpload.mockResolvedValueOnce(mockSuccessResponse);

    const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2Q==';
    const result = await uploadImage({ base64: base64Data });

    expect(mockUpload).toHaveBeenCalledWith({
      image: '/9j/4AAQSkZJRgABAQEAYABgAAD/2Q==', // Data URL prefix should be removed
      type: 'base64'
    });
    expect(result).toEqual({
      success: true,
      url: 'https://example.com/image.jpg'
    });
  });

  test('should upload an image from file path successfully', async () => {
    const mockBuffer = Buffer.from('file-content');
    mockReadFile.mockResolvedValueOnce(mockBuffer);
    mockUpload.mockResolvedValueOnce(mockSuccessResponse);

    const result = await uploadImage({ filePath: '/path/to/image.jpg' });

    expect(mockReadFile).toHaveBeenCalledWith('/path/to/image.jpg');
    expect(mockUpload).toHaveBeenCalledWith({
      image: mockBuffer,
      type: 'base64'
    });
    expect(result).toEqual({
      success: true,
      url: 'https://example.com/image.jpg'
    });
  });

  test('should handle upload failure', async () => {
    mockUpload.mockResolvedValueOnce(mockErrorResponse);

    const result = await uploadImage({ base64: 'invalid-data' });

    expect(result).toEqual({
      success: false,
      url: '',
      error: 'Failed to upload image to Imgur'
    });
  });

  test('should handle exceptions during upload', async () => {
    mockUpload.mockRejectedValueOnce(new Error('Network error'));

    const result = await uploadImage({ base64: 'valid-data' });

    expect(result).toEqual({
      success: false,
      url: '',
      error: 'Network error'
    });
  });

  test('should throw an error if neither base64 nor filePath is provided', async () => {
    const result = await uploadImage({});

    expect(result).toEqual({
      success: false,
      url: '',
      error: 'Either base64 or filePath must be provided'
    });
  });
});