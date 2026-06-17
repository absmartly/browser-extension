import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread
} from "lexical"
import React, { lazy, Suspense } from "react"

const ImageComponent = lazy(() => import("./ImageComponent"))

export interface ImagePayload {
  altText: string
  height?: number
  key?: NodeKey
  maxWidth?: number
  src: string
  width?: number
  uploading?: boolean
  uploaded?: boolean
}

function convertImageElement(domNode: Node): null | DOMConversionOutput {
  if (domNode instanceof HTMLImageElement) {
    const { alt: altText, src, width, height } = domNode
    const node = $createImageNode({ altText, height, src, width })
    return { node }
  }
  return null
}

export type SerializedImageNode = Spread<
  {
    altText: string
    height?: number
    maxWidth: number
    src: string
    width?: number
  },
  SerializedLexicalNode
>

export class ImageNode extends DecoratorNode<React.JSX.Element> {
  __src: string
  __altText: string
  __width: "inherit" | number
  __height: "inherit" | number
  __maxWidth: number
  __uploading: boolean
  __uploaded: boolean

  static getType(): string {
    return "image"
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__maxWidth,
      node.__width,
      node.__height,
      node.__key,
      node.__uploading,
      node.__uploaded
    )
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { altText, height, width, maxWidth, src } = serializedNode
    return $createImageNode({
      altText,
      height,
      maxWidth,
      src,
      width
    })
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("img")
    element.setAttribute("src", this.__src)
    element.setAttribute("alt", this.__altText)
    element.setAttribute("width", this.__width.toString())
    element.setAttribute("height", this.__height.toString())
    return { element }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 0
      })
    }
  }

  constructor(
    src: string,
    altText: string,
    maxWidth: number,
    width?: "inherit" | number,
    height?: "inherit" | number,
    key?: NodeKey,
    uploading?: boolean,
    uploaded?: boolean
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__maxWidth = maxWidth
    this.__width = width || "inherit"
    this.__height = height || "inherit"
    this.__uploading = uploading || false
    this.__uploaded = uploaded || false
  }

  exportJSON(): SerializedImageNode {
    return {
      altText: this.getAltText(),
      height: this.__height === "inherit" ? 0 : this.__height,
      maxWidth: this.__maxWidth,
      src: this.getSrc(),
      type: "image",
      version: 1,
      width: this.__width === "inherit" ? 0 : this.__width
    }
  }

  setWidthAndHeight(
    width: "inherit" | number,
    height: "inherit" | number
  ): void {
    const writable = this.getWritable()
    writable.__width = width
    writable.__height = height
  }

  setUploading(uploading: boolean): void {
    const writable = this.getWritable()
    writable.__uploading = uploading
  }

  setSrc(src: string): void {
    const writable = this.getWritable()
    writable.__src = src
  }

  createDOM(_: EditorConfig): HTMLElement {
    const span = document.createElement("span")
    span.className = "inline-block relative align-bottom"
    return span
  }

  updateDOM(): false {
    return false
  }

  getSrc(): string {
    return this.__src
  }

  getAltText(): string {
    return this.__altText
  }

  decorate(): React.JSX.Element {
    return (
      <Suspense fallback={null}>
        <ImageComponent
          src={this.__src}
          altText={this.__altText}
          width={this.__width}
          height={this.__height}
          maxWidth={this.__maxWidth}
          nodeKey={this.getKey()}
          uploading={this.__uploading}
        />
      </Suspense>
    )
  }
}

export function $createImageNode({
  altText,
  height,
  maxWidth = 500,
  src,
  width,
  key,
  uploading
}: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(src, altText, maxWidth, width, height, key, uploading)
  )
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode
}
